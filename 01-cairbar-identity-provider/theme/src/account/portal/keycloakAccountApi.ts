import type { BaseEnvironment, KeycloakContext } from "../../shared/keycloak-ui-shared";
import {
    deleteConsent,
    deleteSession,
    getApplications,
    getCredentials,
    getDevices,
    getGroups,
    getPersonalInfo,
    savePersonalInfo
} from "../api/methods";
import { token } from "../api/request";
import { CardApiError, ProfileValidationError, type AccountApi, type FieldError, type Profile } from "./api";

async function ensureOk(response: Response) {
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}

/** AccountApi sobre os métodos do @keycloakify/keycloak-account-ui (token renovado a cada chamada). */
export function createKeycloakAccountApi(context: KeycloakContext<BaseEnvironment>): AccountApi {
    const { keycloak, environment } = context;
    const getAccessToken = token(keycloak);

    // Serviço de Carteirinha publicado pelo mesmo nginx do Keycloak (sem CORS).
    async function cards<T>(path: string, init: { method?: "POST"; signal?: AbortSignal } = {}): Promise<T> {
        const response = await fetch(new URL(`/api/v1/cards/${path}`, environment.serverBaseUrl), {
            ...init,
            headers: { authorization: `Bearer ${await getAccessToken()}`, accept: "application/json" }
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new CardApiError(response.status, typeof body.code === "string" ? body.code : "HTTP_ERROR");
        }
        return response.json() as Promise<T>;
    }

    return {
        getProfile: signal => getPersonalInfo({ context, signal }) as Promise<Profile>,
        saveProfile: async profile => {
            // Os metadados não fazem parte da atualização.
            const body: Partial<Profile> = { ...profile };
            delete body.userProfileMetadata;
            try {
                await savePersonalInfo(context, body);
            } catch (errors) {
                if (Array.isArray(errors)) {
                    throw new ProfileValidationError(errors as FieldError[]);
                }
                throw errors;
            }
        },
        getCredentials: signal => getCredentials({ context, signal }),
        getDevices: signal => getDevices({ context, signal }),
        deleteSession: async id => ensureOk(await deleteSession(context, id)),
        getGroups: signal => getGroups({ context, signal }),
        getApplications: signal => getApplications({ context, signal }),
        deleteConsent: async clientId => ensureOk(await deleteConsent(context, clientId)),
        requestAction: action => keycloak.login({ action }),
        logout: () => keycloak.logout(),
        getCard: (personId, signal) => cards(encodeURIComponent(personId), { signal }),
        issueGoogleWallet: personId => cards(`${encodeURIComponent(personId)}/issue/google`, { method: "POST" })
    };
}
