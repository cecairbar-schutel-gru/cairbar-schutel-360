import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrate } from "../src/migrate.js";
import { createPgRepository } from "../src/repository.js";

/**
 * Integração com PostgreSQL real: roda só com TEST_DATABASE_URL apontando para um banco
 * descartável (as tabelas são apagadas antes).
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("repositório PostgreSQL", () => {
    let pool: pg.Pool;

    beforeAll(async () => {
        pool = new pg.Pool({ connectionString: databaseUrl });
        await pool.query("DROP TABLE IF EXISTS audit_event, wallet_credential, digital_card, schema_migrations");
        expect(await migrate(databaseUrl!)).toEqual(["0001_carteirinha.sql"]);
        expect(await migrate(databaseUrl!)).toEqual([]);
    });

    afterAll(async () => {
        await pool?.end();
    });

    it("cria uma única carteirinha por personId e registra a carteira do Google", async () => {
        const repo = createPgRepository(pool);
        const [a, b] = await Promise.all([repo.activateCard("PER-00000001", "user-1"), repo.activateCard("PER-00000001", "user-1")]);
        expect(a.id).toBe(b.id);
        expect(a).toMatchObject({ personId: "PER-00000001", status: "ACTIVE", version: 1 });

        await repo.saveWallet(a.id, "GOOGLE", "1.dev-PER-00000001-v1", "ACTIVE");
        await repo.saveWallet(a.id, "GOOGLE", "1.dev-PER-00000001-v1", "ACTIVE");
        expect(await repo.listWallets(a.id)).toMatchObject([{ provider: "GOOGLE", status: "ACTIVE" }]);

        await repo.audit({ actorId: "user-1", action: "CARD_ISSUE_GOOGLE_WALLET", targetType: "PERSON", targetId: "PER-00000001", result: "SUCCESS" });
        const { rows } = await pool.query("SELECT count(*)::int AS n FROM audit_event");
        expect(rows[0].n).toBe(1);
    });

    it("não reativa carteirinha revogada", async () => {
        const repo = createPgRepository(pool);
        await pool.query("INSERT INTO digital_card (person_id, status, created_by, updated_by) VALUES ('PER-00000002', 'REVOKED', 'adm', 'adm')");
        expect((await repo.activateCard("PER-00000002", "user-2")).status).toBe("REVOKED");
    });

    it("recusa personId fora do formato no banco", async () => {
        await expect(
            pool.query("INSERT INTO digital_card (person_id, status, created_by, updated_by) VALUES ('maria@example.org', 'ACTIVE', 'x', 'x')")
        ).rejects.toThrow();
    });
});
