import pg from "pg";
import { buildApp } from "./app.js";
import { createTokenVerifier, remoteKeys } from "./auth.js";
import { createCardService } from "./cardService.js";
import { loadConfig } from "./config.js";
import { createFederatedCredentials } from "./gcpFederation.js";
import { createGoogleWallet, WALLET_SCOPE } from "./googleWallet.js";
import { createKeycloakDirectory } from "./keycloak.js";
import { createPgRepository } from "./repository.js";

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

const app = buildApp({
    verifyToken: createTokenVerifier({
        issuer: config.keycloak.issuer,
        audience: config.keycloak.audience,
        allowedClients: config.keycloak.allowedClients,
        keys: remoteKeys(config.keycloak.internalUrl, config.keycloak.realm)
    }),
    cards: createCardService({
        repository: createPgRepository(pool),
        directory: createKeycloakDirectory(config.keycloak),
        googleWallet: createGoogleWallet({
            ...config.googleWallet,
            environment: config.environment,
            origins: [config.googleWallet.origin],
            credentials: createFederatedCredentials({
                keycloak: { ...config.keycloak, ...config.gcp },
                provider: config.gcp.provider,
                serviceAccountEmail: config.googleWallet.serviceAccountEmail,
                scopes: [WALLET_SCOPE]
            })
        })
    }),
    ready: async () => {
        await pool.query("SELECT 1");
    },
    logger: { level: process.env.LOG_LEVEL ?? "info" }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
        await app.close();
        await pool.end();
        process.exit(0);
    });
}

await app.listen({ port: config.port, host: config.host });
