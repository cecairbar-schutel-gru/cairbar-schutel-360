/**
 * Configuração por variáveis de ambiente (seção 24.8). Em produção vêm do EnvironmentFile
 * do systemd gerado pelo Ansible; localmente, de um .env (ver .env.example).
 */

import { PROVIDER_PATTERN } from "./gcpFederation.js";

export type Config = {
    port: number;
    host: string;
    /** dev | hml | prd — entra no ID dos objetos do Google Wallet para não colidir entre ambientes. */
    environment: string;
    databaseUrl: string;
    keycloak: {
        /** Issuer público esperado nos tokens (https://<host>/realms/cecairbar). */
        issuer: string;
        /** URL interna do Keycloak (JWKS e Admin API sem passar pelo nginx). */
        internalUrl: string;
        realm: string;
        /** Audience exigida nos tokens: o clientId do próprio serviço. */
        audience: string;
        /** Clientes (azp) autorizados a pedir a auto-emissão. */
        allowedClients: string[];
        clientId: string;
        clientSecret: string;
    };
    /** Workload Identity Federation: credenciais do Google Cloud sem chave de conta de serviço. */
    gcp: {
        /** Cliente do realm cujo token o STS do Google aceita (aud = provedor do pool). */
        clientId: string;
        clientSecret: string;
        /** projects/<número>/locations/global/workloadIdentityPools/<pool>/providers/<provedor> */
        provider: string;
    };
    googleWallet: {
        issuerId: string;
        /** Conta de serviço convidada no Pay & Wallet Console (personificada pela federação). */
        serviceAccountEmail: string;
        /** Origem do portal, autorizada no JWT do botão "Salvar no Google Wallet". */
        origin: string;
        /** URL pública (HTTPS) de /api/v1/cards/assets; opcional — o Google precisa conseguir baixar as imagens. */
        assetsBaseUrl?: string;
        backgroundColor: string;
        issuerName: string;
        /** Texto de contato em caso de perda ou uso indevido (seção 9.2). */
        contactText?: string;
    };
};

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name]?.trim();
    if (!value) {
        throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
    return value;
}

function optional(env: NodeJS.ProcessEnv, name: string): string | undefined {
    const value = env[name]?.trim();
    return value ? value : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const issuer = required(env, "KEYCLOAK_ISSUER").replace(/\/$/, "");
    const realm = issuer.split("/realms/")[1];
    if (!realm) {
        throw new Error("KEYCLOAK_ISSUER deve terminar em /realms/<realm>");
    }
    const issuerId = required(env, "GOOGLE_WALLET_ISSUER_ID");
    if (!/^[0-9]+$/.test(issuerId)) {
        throw new Error("GOOGLE_WALLET_ISSUER_ID deve ser numérico");
    }
    const provider = required(env, "GCP_WIF_PROVIDER");
    if (!PROVIDER_PATTERN.test(provider)) {
        throw new Error("GCP_WIF_PROVIDER deve seguir projects/<número>/locations/global/workloadIdentityPools/<pool>/providers/<provedor>");
    }
    const environment = required(env, "APP_ENVIRONMENT");
    if (!/^[a-z0-9]+$/.test(environment)) {
        throw new Error("APP_ENVIRONMENT deve conter só letras minúsculas e dígitos (ex.: dev)");
    }

    return {
        port: Number(env.PORT ?? 8280),
        host: env.HOST ?? "127.0.0.1",
        environment,
        databaseUrl: required(env, "DATABASE_URL"),
        keycloak: {
            issuer,
            internalUrl: required(env, "KEYCLOAK_INTERNAL_URL").replace(/\/$/, ""),
            realm,
            audience: env.KEYCLOAK_AUDIENCE ?? "servico-carteirinha",
            allowedClients: (env.KEYCLOAK_ALLOWED_CLIENTS ?? "account-console")
                .split(",")
                .map(c => c.trim())
                .filter(Boolean),
            clientId: env.KEYCLOAK_CLIENT_ID ?? "servico-carteirinha",
            clientSecret: required(env, "KEYCLOAK_CLIENT_SECRET")
        },
        gcp: {
            clientId: env.KEYCLOAK_GCP_CLIENT_ID ?? "servico-carteirinha-gcp",
            clientSecret: required(env, "KEYCLOAK_GCP_CLIENT_SECRET"),
            provider
        },
        googleWallet: {
            issuerId,
            serviceAccountEmail: required(env, "GOOGLE_WALLET_SERVICE_ACCOUNT"),
            origin: new URL(issuer).origin,
            assetsBaseUrl: optional(env, "GOOGLE_WALLET_ASSETS_BASE_URL"),
            // Fundo branco, como o cartão do portal (theme/src/account/portal/pages/Carteirinha.tsx).
            backgroundColor: env.GOOGLE_WALLET_BACKGROUND_COLOR ?? "#FFFFFF",
            issuerName: env.GOOGLE_WALLET_ISSUER_NAME ?? "CE Cairbar Schutel Guarulhos",
            contactText: optional(env, "GOOGLE_WALLET_CONTACT_TEXT")
        }
    };
}
