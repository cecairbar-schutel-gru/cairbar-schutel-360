import { IdentityPoolClient } from "google-auth-library";
import type { WalletCredentials } from "./googleWallet.js";
import { createClientCredentialsToken, type KeycloakAdminOptions } from "./keycloak.js";

/**
 * Acesso ao Google Cloud por Workload Identity Federation, sem chave de conta de serviço:
 * o realm emite um access token (Client Credentials do cliente servico-carteirinha-gcp, com
 * aud = provedor do pool) que o STS do Google troca por um token federado de curta duração.
 * Com ele o serviço personifica a conta de serviço do Google Wallet e assina o JWT do botão
 * "Salvar" pela IAM Credentials API (chave gerenciada pelo Google, que nunca sai de lá).
 * Docs: https://cloud.google.com/iam/docs/workload-identity-federation-with-other-providers
 */

const STS_URL = "https://sts.googleapis.com/v1/token";
const IAM_CREDENTIALS = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts";
const CLOUD_PLATFORM = "https://www.googleapis.com/auth/cloud-platform";

/** projects/<número>/locations/global/workloadIdentityPools/<pool>/providers/<provedor> */
export const PROVIDER_PATTERN = /^projects\/[0-9]+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/;

export type FederationOptions = {
    keycloak: KeycloakAdminOptions;
    /** Nome do recurso do provedor OIDC do pool (PROVIDER_PATTERN). */
    provider: string;
    serviceAccountEmail: string;
    /** Escopos do token da conta de serviço (ex.: wallet_object.issuer). */
    scopes: string[];
};

export function createFederatedCredentials(options: FederationOptions): WalletCredentials {
    const subjectToken = createClientCredentialsToken(options.keycloak);
    const email = encodeURIComponent(options.serviceAccountEmail);
    const base = {
        audience: `//iam.googleapis.com/${options.provider}`,
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: STS_URL,
        subject_token_supplier: { getSubjectToken: subjectToken }
    };
    // Token da conta de serviço (personificada) para a Wallet API.
    const serviceAccount = new IdentityPoolClient({
        ...base,
        service_account_impersonation_url: `${IAM_CREDENTIALS}/${email}:generateAccessToken`,
        scopes: options.scopes
    });
    // Token federado (sem personificação) para o signJwt: assim basta conceder ao principal do
    // pool roles/iam.serviceAccountTokenCreator na conta de serviço, sem auto-concessão.
    const federated = new IdentityPoolClient({ ...base, scopes: [CLOUD_PLATFORM] });

    return {
        serviceAccountEmail: options.serviceAccountEmail,

        async request(request) {
            const response = await serviceAccount.request({ ...request, validateStatus: () => true });
            return { status: response.status, data: response.data };
        },

        async signJwt(claims) {
            const response = await federated.request<{ signedJwt: string }>({
                url: `${IAM_CREDENTIALS}/${email}:signJwt`,
                method: "POST",
                data: { payload: JSON.stringify(claims) },
                validateStatus: () => true
            });
            if (response.status >= 300) {
                throw new Error(`IAM Credentials: falha ao assinar o JWT (HTTP ${response.status})`);
            }
            return response.data.signedJwt;
        }
    };
}
