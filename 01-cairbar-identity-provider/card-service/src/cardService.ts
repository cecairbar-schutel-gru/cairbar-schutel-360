import type { Principal } from "./auth.js";
import type { GoogleWallet } from "./googleWallet.js";
import type { CardStatus, IdentityDirectory } from "./keycloak.js";
import type { CardRepository, WalletCredential } from "./repository.js";

/** Erro de regra de negócio, devolvido ao cliente com um código estável. */
export class CardError extends Error {
    constructor(
        readonly status: 403 | 404 | 409 | 502,
        readonly code: string,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);
    }
}

export type CardView = {
    personId: string;
    status: CardStatus;
    version: number | null;
    issuedAt: string | null;
    wallets: { provider: WalletCredential["provider"]; status: WalletCredential["status"]; issuedAt: string }[];
};

export type IssueResult = { saveUrl: string; card: CardView };

type Deps = {
    repository: CardRepository;
    directory: IdentityDirectory;
    googleWallet: GoogleWallet;
};

const BLOCKED: readonly string[] = ["SUSPENDED", "REVOKED"];

/**
 * Auto-emissão: a própria pessoa autenticada emite a carteirinha. Só vale para o personId do
 * token — qualquer outro recebe o mesmo 403, exista ou não (sem enumeração de IDs).
 * TODO(seção 23.5): emissão, suspensão e reemissão por operadores/administradores (roles a definir).
 */
export function createCardService({ repository, directory, googleWallet }: Deps) {
    function assertOwner(principal: Principal, personId: string) {
        if (principal.personId !== personId) {
            throw new CardError(403, "FORBIDDEN", "Operação permitida somente sobre a própria carteirinha");
        }
    }

    async function view(personId: string): Promise<CardView> {
        const card = await repository.findCard(personId);
        if (card === undefined) {
            return { personId, status: "NOT_ISSUED", version: null, issuedAt: null, wallets: [] };
        }
        const wallets = await repository.listWallets(card.id);
        return {
            personId,
            status: card.status,
            version: card.version,
            issuedAt: card.issuedAt?.toISOString() ?? null,
            wallets: wallets.map(w => ({ provider: w.provider, status: w.status, issuedAt: w.issuedAt.toISOString() }))
        };
    }

    return {
        async getCard(principal: Principal, personId: string): Promise<CardView> {
            assertOwner(principal, personId);
            return view(personId);
        },

        async issueGoogle(principal: Principal, personId: string, correlationId: string): Promise<IssueResult> {
            assertOwner(principal, personId);
            const audit = (result: "SUCCESS" | "FAILURE", metadata: Record<string, string | number>) =>
                repository.audit({
                    actorId: principal.subject,
                    action: "CARD_ISSUE_GOOGLE_WALLET",
                    targetType: "PERSON",
                    targetId: personId,
                    result,
                    correlationId,
                    metadata: { clientId: principal.clientId, ...metadata }
                });

            // Situação lida no Keycloak (System of Record), não no token, que pode estar desatualizado.
            const identity = await directory.getIdentity(principal.subject);
            if (identity === undefined || identity.personId !== personId) {
                await audit("FAILURE", { reason: "IDENTITY_MISMATCH" });
                throw new CardError(403, "FORBIDDEN", "Operação permitida somente sobre a própria carteirinha");
            }
            if (identity.identityStatus !== "ACTIVE") {
                await audit("FAILURE", { reason: "IDENTITY_NOT_ACTIVE" });
                throw new CardError(409, "IDENTITY_NOT_ACTIVE", "A identidade não está ativa");
            }
            const existing = await repository.findCard(personId);
            if (BLOCKED.includes(identity.cardStatus ?? "") || BLOCKED.includes(existing?.status ?? "")) {
                await audit("FAILURE", { reason: "CARD_BLOCKED" });
                throw new CardError(409, "CARD_BLOCKED", "A carteirinha está suspensa ou revogada");
            }

            // Emissão repetida é idempotente: mesma carteirinha e mesmo objeto, com os dados visuais atualizados.
            const card = await repository.activateCard(personId, principal.subject);
            let objectId: string;
            try {
                objectId = await googleWallet.upsertPass({ personId, displayName: identity.displayName, version: card.version });
            } catch (error) {
                await audit("FAILURE", { reason: "GOOGLE_WALLET_ERROR", cardVersion: card.version });
                throw new CardError(502, "GOOGLE_WALLET_UNAVAILABLE", "Google Wallet indisponível no momento", { cause: error });
            }
            await repository.saveWallet(card.id, "GOOGLE", objectId, "ACTIVE");
            // TODO(seção 23.8): sem Keycloak, a emissão falha aqui e a repetição corrige o cardStatus.
            await directory.setCardStatus(principal.subject, "ACTIVE");

            let saveUrl: string;
            try {
                saveUrl = await googleWallet.saveUrl(objectId);
            } catch (error) {
                // A carteirinha já está ativa; repetir a emissão gera o link de novo.
                await audit("FAILURE", { reason: "GOOGLE_WALLET_ERROR", cardVersion: card.version });
                throw new CardError(502, "GOOGLE_WALLET_UNAVAILABLE", "Google Wallet indisponível no momento", { cause: error });
            }
            await audit("SUCCESS", { cardVersion: card.version, providerObjectId: objectId });

            return { saveUrl, card: await view(personId) };
        }
    };
}

export type CardService = ReturnType<typeof createCardService>;
