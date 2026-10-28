/**
 * Acesso restrito à Admin API do Keycloak (seção 9.5) com o cliente de serviço
 * servico-carteirinha (Client Credentials). O Keycloak continua System of Record do perfil:
 * o serviço só lê o necessário para a emissão e grava cardStatus.
 */

export type IdentityStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type CardStatus = "NOT_ISSUED" | "ACTIVE" | "SUSPENDED" | "REVOKED";

/** Recorte do perfil usado na emissão — não é persistido pelo serviço. */
export type Identity = {
    personId?: string;
    displayName: string;
    identityStatus?: string;
    cardStatus?: string;
};

export type IdentityDirectory = {
    getIdentity: (userId: string) => Promise<Identity | undefined>;
    setCardStatus: (userId: string, status: CardStatus) => Promise<void>;
};

type UserRepresentation = {
    id: string;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, string[]>;
    [key: string]: unknown;
};

const first = (user: UserRepresentation, name: string) => user.attributes?.[name]?.find(v => v !== "");

export type KeycloakAdminOptions = {
    internalUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    fetch?: typeof fetch;
};

/** Token de um cliente de serviço (Client Credentials), reaproveitado até perto de expirar. */
export function createClientCredentialsToken(options: KeycloakAdminOptions): () => Promise<string> {
    const doFetch = options.fetch ?? fetch;
    let cached: { token: string; expiresAt: number } | undefined;

    return async () => {
        if (cached && cached.expiresAt > Date.now() + 10_000) {
            return cached.token;
        }
        const response = await doFetch(`${options.internalUrl}/realms/${options.realm}/protocol/openid-connect/token`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: options.clientId,
                client_secret: options.clientSecret
            })
        });
        if (!response.ok) {
            throw new Error(`Keycloak: falha ao obter token de serviço (HTTP ${response.status})`);
        }
        const body = (await response.json()) as { access_token: string; expires_in: number };
        cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
        return cached.token;
    };
}

export function createKeycloakDirectory(options: KeycloakAdminOptions): IdentityDirectory {
    const doFetch = options.fetch ?? fetch;
    const adminUrl = `${options.internalUrl}/admin/realms/${options.realm}`;
    const accessToken = createClientCredentialsToken(options);

    async function getUser(userId: string): Promise<UserRepresentation | undefined> {
        const response = await doFetch(`${adminUrl}/users/${encodeURIComponent(userId)}`, {
            headers: { authorization: `Bearer ${await accessToken()}` }
        });
        if (response.status === 404) {
            return undefined;
        }
        if (!response.ok) {
            throw new Error(`Keycloak: falha ao ler usuário (HTTP ${response.status})`);
        }
        return (await response.json()) as UserRepresentation;
    }

    return {
        async getIdentity(userId) {
            const user = await getUser(userId);
            if (user === undefined) {
                return undefined;
            }
            return {
                personId: first(user, "personId"),
                // Mesma regra do portal: nome de preferência > nome > nome completo (seção 9.2).
                displayName: first(user, "preferredName") ?? user.firstName ?? first(user, "fullName") ?? "",
                identityStatus: first(user, "identityStatus"),
                cardStatus: first(user, "cardStatus")
            };
        },

        async setCardStatus(userId, status) {
            const user = await getUser(userId);
            if (user === undefined) {
                throw new Error("Keycloak: usuário não encontrado");
            }
            if (first(user, "cardStatus") === status) {
                return;
            }
            // Reenvia a representação completa: com o User Profile, atributos ausentes no PUT seriam removidos.
            const body = { ...user, attributes: { ...user.attributes, cardStatus: [status] } };
            const response = await doFetch(`${adminUrl}/users/${encodeURIComponent(userId)}`, {
                method: "PUT",
                headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                throw new Error(`Keycloak: falha ao gravar cardStatus (HTTP ${response.status})`);
            }
        }
    };
}
