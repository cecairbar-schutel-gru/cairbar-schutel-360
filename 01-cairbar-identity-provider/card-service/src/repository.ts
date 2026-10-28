import pg from "pg";
import type { CardStatus } from "./keycloak.js";

export type WalletProvider = "APPLE" | "GOOGLE";
export type WalletStatus = "ACTIVE" | "REVOKED" | "ERROR";

export type DigitalCard = {
    id: string;
    personId: string;
    status: CardStatus;
    version: number;
    issuedAt: Date | null;
};

export type WalletCredential = {
    provider: WalletProvider;
    providerObjectId: string;
    status: WalletStatus;
    issuedAt: Date;
    lastUpdatedAt: Date;
};

export type AuditEvent = {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    result: "SUCCESS" | "FAILURE";
    correlationId?: string;
    /** Somente dados técnicos — nunca PII, tokens ou o perfil. */
    metadata?: Record<string, string | number | boolean>;
};

export type CardRepository = {
    findCard: (personId: string) => Promise<DigitalCard | undefined>;
    /** Cria a carteirinha como ACTIVE (versão 1) ou a ativa se estiver NOT_ISSUED. */
    activateCard: (personId: string, actorId: string) => Promise<DigitalCard>;
    listWallets: (cardId: string) => Promise<WalletCredential[]>;
    saveWallet: (cardId: string, provider: WalletProvider, providerObjectId: string, status: WalletStatus) => Promise<void>;
    audit: (event: AuditEvent) => Promise<void>;
};

type CardRow = { id: string; person_id: string; status: CardStatus; version: number; issued_at: Date | null };

const toCard = (row: CardRow): DigitalCard => ({
    id: row.id,
    personId: row.person_id,
    status: row.status,
    version: row.version,
    issuedAt: row.issued_at
});

export function createPgRepository(pool: pg.Pool): CardRepository {
    async function findCard(personId: string) {
        const { rows } = await pool.query<CardRow>(
            "SELECT id, person_id, status, version, issued_at FROM digital_card WHERE person_id = $1",
            [personId]
        );
        return rows[0] && toCard(rows[0]);
    }

    return {
        findCard,

        async activateCard(personId, actorId) {
            // Concorrência: a unicidade de person_id garante uma única carteirinha por pessoa.
            const { rows } = await pool.query<CardRow>(
                `INSERT INTO digital_card (person_id, status, issued_at, created_by, updated_by)
                 VALUES ($1, 'ACTIVE', now(), $2, $2)
                 ON CONFLICT (person_id) DO UPDATE
                    SET status = 'ACTIVE', issued_at = now(), updated_by = $2, updated_at = now()
                    WHERE digital_card.status = 'NOT_ISSUED'
                 RETURNING id, person_id, status, version, issued_at`,
                [personId, actorId]
            );
            if (rows[0]) {
                return toCard(rows[0]);
            }
            const existing = await findCard(personId);
            if (!existing) {
                throw new Error("Carteirinha não encontrada após a ativação");
            }
            return existing;
        },

        async listWallets(cardId) {
            const { rows } = await pool.query<{
                provider: WalletProvider;
                provider_object_id: string;
                status: WalletStatus;
                issued_at: Date;
                last_updated_at: Date;
            }>(
                `SELECT provider, provider_object_id, status, issued_at, last_updated_at
                 FROM wallet_credential WHERE digital_card_id = $1 ORDER BY issued_at`,
                [cardId]
            );
            return rows.map(r => ({
                provider: r.provider,
                providerObjectId: r.provider_object_id,
                status: r.status,
                issuedAt: r.issued_at,
                lastUpdatedAt: r.last_updated_at
            }));
        },

        async saveWallet(cardId, provider, providerObjectId, status) {
            await pool.query(
                `INSERT INTO wallet_credential (digital_card_id, provider, provider_object_id, status)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (provider_object_id) DO UPDATE SET status = $4, last_updated_at = now()`,
                [cardId, provider, providerObjectId, status]
            );
        },

        async audit(event) {
            await pool.query(
                `INSERT INTO audit_event (actor_id, action, target_type, target_id, result, correlation_id, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    event.actorId,
                    event.action,
                    event.targetType,
                    event.targetId,
                    event.result,
                    event.correlationId ?? null,
                    JSON.stringify(event.metadata ?? {})
                ]
            );
        }
    };
}
