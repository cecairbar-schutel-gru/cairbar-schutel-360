import { createContext, useContext } from "react";
import type {
    ClientRepresentation,
    CredentialContainer,
    DeviceRepresentation,
    Group
} from "../api/representations";

export type { ClientRepresentation, CredentialContainer, DeviceRepresentation, Group };

/** Metadados de um atributo do User Profile (GET /account/?userProfileMetadata=true). */
export type ProfileAttributeMetadata = {
    name: string;
    displayName?: string;
    required: boolean;
    readOnly: boolean;
    multivalued?: boolean;
    group?: string;
    annotations?: Record<string, unknown>;
    validators: Record<string, Record<string, unknown>>;
};

export type ProfileGroupMetadata = {
    name: string;
    displayHeader?: string;
    displayDescription?: string;
};

/**
 * Representação do usuário na Account REST API. username/email/firstName/lastName vêm na
 * raiz; os demais atributos (personId, cardStatus...) em `attributes`.
 */
export type Profile = {
    id?: string;
    username?: string;
    email?: string;
    emailVerified?: boolean;
    firstName?: string;
    lastName?: string;
    attributes?: Record<string, string[]>;
    userProfileMetadata: {
        attributes: ProfileAttributeMetadata[];
        groups?: ProfileGroupMetadata[];
    };
};

/** Erro de validação devolvido pelo POST /account/ (ex.: error-user-attribute-read-only). */
export type FieldError = { field: string; errorMessage: string; params?: string[] };

export class ProfileValidationError extends Error {
    constructor(readonly errors: FieldError[]) {
        super("Falha de validação do perfil");
    }
}

/** Carteirinha no Serviço de Carteirinha (GET /api/v1/cards/{personId}). */
export type CardView = {
    personId: string;
    status: "NOT_ISSUED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
    version: number | null;
    issuedAt: string | null;
    wallets: { provider: "APPLE" | "GOOGLE"; status: "ACTIVE" | "REVOKED" | "ERROR"; issuedAt: string }[];
};

/** Erro do Serviço de Carteirinha com o código estável da API (IDENTITY_NOT_ACTIVE, CARD_BLOCKED...). */
export class CardApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string
    ) {
        super(`Serviço de Carteirinha: ${code}`);
    }
}

/**
 * Operações do portal sobre a Account REST API do Keycloak (/realms/cecairbar/account/...).
 * A implementação real usa o token do account-console em memória (oidc-spa); o Storybook usa um mock.
 */
export type AccountApi = {
    getProfile: (signal?: AbortSignal) => Promise<Profile>;
    saveProfile: (profile: Profile) => Promise<void>;
    getCredentials: (signal?: AbortSignal) => Promise<CredentialContainer[]>;
    getDevices: (signal?: AbortSignal) => Promise<DeviceRepresentation[]>;
    /** Sem id: encerra todas as outras sessões (a atual continua). */
    deleteSession: (id?: string) => Promise<void>;
    getGroups: (signal?: AbortSignal) => Promise<Group[]>;
    getApplications: (signal?: AbortSignal) => Promise<ClientRepresentation[]>;
    deleteConsent: (clientId: string) => Promise<void>;
    /** Ação de aplicação do Keycloak (kc_action): UPDATE_PASSWORD, CONFIGURE_TOTP, delete_credential:<id>... */
    requestAction: (action: string) => Promise<void>;
    logout: () => Promise<void>;
    /** Serviço de Carteirinha (/api/v1/cards, mesmo host), com o mesmo token do portal. */
    getCard: (personId: string, signal?: AbortSignal) => Promise<CardView>;
    /** Auto-emissão no Google Wallet: devolve o link "Salvar no Google Wallet". */
    issueGoogleWallet: (personId: string) => Promise<{ saveUrl: string }>;
};

export const AccountApiContext = createContext<AccountApi | undefined>(undefined);

export function useAccountApi(): AccountApi {
    const api = useContext(AccountApiContext);
    if (api === undefined) {
        throw new Error("AccountApiContext ausente");
    }
    return api;
}
