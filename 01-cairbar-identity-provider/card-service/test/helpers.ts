import { createHash, randomUUID } from "node:crypto";
import { calculateJwkThumbprint, createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { createTokenVerifier } from "../src/auth.js";
import type { GoogleWallet, CardPass } from "../src/googleWallet.js";
import type { CardStatus, Identity, IdentityDirectory } from "../src/keycloak.js";
import type { AuditEvent, CardRepository, DigitalCard, WalletCredential } from "../src/repository.js";

export const ISSUER = "https://kc.example.test/realms/cecairbar";
export const AUDIENCE = "servico-carteirinha";

/** Par de chaves do "Keycloak" de teste e emissor de tokens. */
export async function createTestIssuer() {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "test", alg: "RS256", use: "sig" };
    const keys = createLocalJWKSet({ keys: [jwk] });

    async function token(claims: JWTPayload = {}, options: { expiresIn?: string | number; key?: CryptoKey } = {}) {
        // Claims padrão no corpo (e não via setIssuer/setAudience) para os testes poderem adulterá-las.
        return new SignJWT({ iss: ISSUER, aud: AUDIENCE, sub: "user-1", typ: "Bearer", azp: "account-console", person_id: "PER-00000001", ...claims })
            .setProtectedHeader({ alg: "RS256", kid: "test" })
            .setIssuedAt()
            .setExpirationTime(options.expiresIn ?? "5m")
            .sign(options.key ?? privateKey);
    }

    const verifyToken = createTokenVerifier({ issuer: ISSUER, audience: AUDIENCE, allowedClients: ["account-console"], keys });
    return { token, verifyToken, keys };
}

/** Chave DPoP do "navegador": jkt para o cnf do token e provas (RFC 9449) para cada requisição. */
export async function createDpopKey() {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const jwk = await exportJWK(publicKey);
    const jkt = await calculateJwkThumbprint(jwk);

    async function proof(
        accessToken: string,
        { method = "GET", url, jti = randomUUID(), iat = Math.floor(Date.now() / 1000) }: { method?: string; url: string; jti?: string; iat?: number }
    ) {
        const ath = createHash("sha256").update(accessToken).digest("base64url");
        return new SignJWT({ jti, htm: method, htu: url, iat, ath })
            .setProtectedHeader({ alg: "ES256", typ: "dpop+jwt", jwk })
            .sign(privateKey);
    }

    return { jkt, proof };
}

export function memoryRepository() {
    const cards = new Map<string, DigitalCard>();
    const wallets = new Map<string, WalletCredential & { cardId: string }>();
    const events: AuditEvent[] = [];

    const repository: CardRepository = {
        findCard: async personId => cards.get(personId),
        activateCard: async personId => {
            const existing = cards.get(personId);
            if (existing && existing.status !== "NOT_ISSUED") {
                return existing;
            }
            const card: DigitalCard = { id: `card-${personId}`, personId, status: "ACTIVE", version: 1, issuedAt: new Date() };
            cards.set(personId, card);
            return card;
        },
        listWallets: async cardId => [...wallets.values()].filter(w => w.cardId === cardId),
        saveWallet: async (cardId, provider, providerObjectId, status) => {
            const now = new Date();
            const previous = wallets.get(providerObjectId);
            wallets.set(providerObjectId, {
                cardId,
                provider,
                providerObjectId,
                status,
                issuedAt: previous?.issuedAt ?? now,
                lastUpdatedAt: now
            });
        },
        audit: async event => {
            events.push(event);
        }
    };
    return { repository, cards, wallets, events };
}

export function memoryDirectory(users: Record<string, Identity>) {
    const updates: { userId: string; status: CardStatus }[] = [];
    const directory: IdentityDirectory = {
        getIdentity: async userId => users[userId],
        setCardStatus: async (userId, status) => {
            updates.push({ userId, status });
            const user = users[userId];
            if (user) {
                user.cardStatus = status;
            }
        }
    };
    return { directory, updates };
}

export function fakeGoogleWallet(options: { fail?: boolean } = {}) {
    const passes: CardPass[] = [];
    const googleWallet: GoogleWallet = {
        upsertPass: async pass => {
            if (options.fail) {
                throw new Error("HTTP 503");
            }
            passes.push(pass);
            return `3388000000000000000.dev-${pass.personId}-v${pass.version}`;
        },
        saveUrl: async id => `https://pay.google.com/gp/v/save/jwt-for-${id}`
    };
    return { googleWallet, passes };
}
