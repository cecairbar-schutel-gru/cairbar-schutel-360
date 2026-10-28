import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/**
 * Migrations versionadas (seção 24.9): arquivos NNNN_nome.sql em ../migrations, aplicados em
 * ordem, cada um em sua transação, e registrados em schema_migrations. Nunca edite um
 * arquivo já aplicado — crie o próximo.
 */
export async function migrate(databaseUrl: string, dir = fileURLToPath(new URL("../migrations/", import.meta.url))) {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    const applied: string[] = [];
    try {
        await client.query(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        );
        // Impede duas execuções simultâneas.
        await client.query("SELECT pg_advisory_lock(hashtext('schema_migrations'))");
        const { rows } = await client.query<{ version: string }>("SELECT version FROM schema_migrations");
        const done = new Set(rows.map(r => r.version));
        const files = (await readdir(dir)).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
        for (const file of files) {
            const version = file.slice(0, 4);
            if (done.has(version)) {
                continue;
            }
            const sql = await readFile(join(dir, file), "utf8");
            await client.query("BEGIN");
            try {
                await client.query(sql);
                await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
                await client.query("COMMIT");
            } catch (error) {
                await client.query("ROLLBACK");
                throw new Error(`Falha na migration ${file}: ${(error as Error).message}`);
            }
            applied.push(file);
        }
    } finally {
        await client.end();
    }
    return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error("DATABASE_URL não definida");
        process.exit(1);
    }
    const applied = await migrate(databaseUrl);
    // Saída lida pelo Ansible para marcar a tarefa como alterada.
    console.log(applied.length > 0 ? `aplicadas: ${applied.join(", ")}` : "nenhuma migration pendente");
}
