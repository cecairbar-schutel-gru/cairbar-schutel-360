import { CardApiError, ProfileValidationError, type AccountApi, type CardView, type Profile } from "./api";
import type { ClientRepresentation, CredentialContainer, DeviceRepresentation, Group } from "./api";

/** Dados fictícios para o Storybook — nenhuma pessoa real. */

const metadata: Profile["userProfileMetadata"] = {
    groups: [
        { name: "user-metadata", displayHeader: "User metadata" },
        { name: "identidade", displayHeader: "Identidade", displayDescription: "Identificação e situação da pessoa na organização" }
    ],
    attributes: [
        { name: "username", displayName: "${username}", required: true, readOnly: true, validators: {} },
        { name: "email", displayName: "${email}", required: false, readOnly: false, validators: { email: {} } },
        { name: "firstName", displayName: "${firstName}", required: false, readOnly: false, validators: { length: { max: 255 } } },
        { name: "lastName", displayName: "${lastName}", required: false, readOnly: false, validators: { length: { max: 255 } } },
        { name: "personId", displayName: "Identificador da pessoa", group: "identidade", required: false, readOnly: true, validators: {} },
        { name: "fullName", displayName: "Nome completo", group: "identidade", required: false, readOnly: true, validators: {} },
        { name: "preferredName", displayName: "Nome de preferência", group: "identidade", required: false, readOnly: false, validators: { length: { max: 255 } } },
        {
            name: "mobilePhone",
            displayName: "Celular",
            group: "identidade",
            required: false,
            readOnly: false,
            validators: { pattern: { pattern: "^\\+?[0-9]{8,15}$", "error-message": "Celular deve conter de 8 a 15 dígitos, opcionalmente com +" } }
        },
        { name: "birthDate", displayName: "Data de nascimento", group: "identidade", required: false, readOnly: true, annotations: { inputType: "html5-date" }, validators: {} },
        { name: "identityStatus", displayName: "Situação da identidade", group: "identidade", required: false, readOnly: true, validators: { options: { options: ["ACTIVE", "INACTIVE", "SUSPENDED"] } } },
        {
            name: "relationships",
            displayName: "Relacionamentos",
            group: "identidade",
            required: false,
            readOnly: true,
            multivalued: true,
            validators: { options: { options: ["VOLUNTEER", "PARTICIPANT"] } }
        },
        { name: "cardStatus", displayName: "Situação da carteirinha", group: "identidade", required: false, readOnly: true, validators: { options: { options: ["NOT_ISSUED", "ACTIVE", "SUSPENDED", "REVOKED"] } } }
    ]
};

export function mockProfile(overrides: Record<string, string[]> = {}): Profile {
    return {
        id: "00000000-0000-0000-0000-000000000001",
        username: "maria.exemplo",
        email: "maria@example.org",
        emailVerified: true,
        firstName: "Maria",
        lastName: "Exemplo",
        attributes: {
            personId: ["PER-00000001"],
            fullName: ["Maria Exemplo da Silva"],
            preferredName: ["Maria"],
            mobilePhone: ["11987654321"],
            birthDate: ["1980-05-17"],
            identityStatus: ["ACTIVE"],
            relationships: ["VOLUNTEER", "PARTICIPANT"],
            cardStatus: ["ACTIVE"],
            ...overrides
        },
        userProfileMetadata: metadata
    };
}

const now = Math.floor(Date.now() / 1000);

const devices: DeviceRepresentation[] = [
    {
        id: "d1",
        ipAddress: "203.0.113.10",
        os: "Mac OS X",
        osVersion: "10.15",
        browser: "Chrome/130",
        device: "Mac",
        lastAccess: now,
        current: true,
        mobile: false,
        sessions: [
            {
                id: "s1",
                ipAddress: "203.0.113.10",
                started: now - 3600,
                lastAccess: now,
                expires: now + 32400,
                browser: "Chrome/130",
                current: true,
                clients: [{ clientId: "account-console", clientName: "${client_account-console}" } as ClientRepresentation]
            }
        ]
    },
    {
        id: "d2",
        ipAddress: "198.51.100.7",
        os: "Android",
        osVersion: "15",
        browser: "Chrome Mobile/130",
        device: "Android",
        lastAccess: now - 86400,
        current: false,
        mobile: true,
        sessions: [
            {
                id: "s2",
                ipAddress: "198.51.100.7",
                started: now - 90000,
                lastAccess: now - 86400,
                expires: now + 3600,
                browser: "Chrome Mobile/130",
                current: false,
                clients: [{ clientId: "scanner-web", clientName: "Scanner Web" } as ClientRepresentation]
            }
        ]
    }
];

const credentials = [
    {
        type: "password",
        category: "basic-authentication",
        displayName: "password-display-name",
        helptext: "password-help-text",
        iconCssClass: "kcAuthenticatorPasswordClass",
        updateAction: "UPDATE_PASSWORD",
        removeable: false,
        userCredentialMetadatas: [
            { credential: { id: "c1", type: "password", userLabel: "", createdDate: Date.now() - 30 * 86400000 } }
        ]
    },
    {
        type: "otp",
        category: "two-factor",
        displayName: "otp-display-name",
        helptext: "otp-help-text",
        iconCssClass: "kcAuthenticatorOTPClass",
        createAction: "CONFIGURE_TOTP",
        removeable: true,
        userCredentialMetadatas: []
    }
] as unknown as CredentialContainer[];

const groups: Group[] = [
    { id: "g1", name: "voluntarios", path: "/voluntarios" },
    { id: "g2", name: "biblioteca", path: "/voluntarios/biblioteca" }
];

const applications = [
    {
        clientId: "account-console",
        clientName: "${client_account-console}",
        description: "",
        userConsentRequired: false,
        inUse: true,
        offlineAccess: false,
        rootUrl: "",
        baseUrl: "",
        effectiveUrl: "https://example.org/realms/cecairbar/account/"
    },
    {
        clientId: "biblioteca",
        clientName: "Biblioteca",
        description: "Empréstimos e devoluções",
        userConsentRequired: true,
        inUse: false,
        offlineAccess: false,
        rootUrl: "",
        baseUrl: "",
        effectiveUrl: "https://biblioteca.example.org/",
        consent: {
            createdDate: Date.now() - 7 * 86400000,
            lastUpdatedDate: Date.now() - 7 * 86400000,
            grantedScopes: [
                { id: "sc1", name: "profile", displayText: "Perfil" },
                { id: "sc2", name: "person_id", displayText: "Identificador da pessoa" }
            ]
        }
    }
] as unknown as ClientRepresentation[];

const delay = <T>(value: T, ms = 300) => new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

export function createMockAccountApi(
    options: { profile?: Profile; empty?: boolean; failing?: boolean; cardError?: string } = {}
): AccountApi {
    let profile = options.profile ?? mockProfile();
    const personId = profile.attributes?.personId?.[0] ?? "PER-00000001";
    let card: CardView = {
        personId,
        status: profile.attributes?.cardStatus?.[0] === "ACTIVE" ? "ACTIVE" : "NOT_ISSUED",
        version: null,
        issuedAt: null,
        wallets: []
    };
    const fail = () => Promise.reject(new Error("falha simulada"));
    const log = (what: string) => () => {
        // Storybook: só registra a ação (nada de PII em console no código real).
        console.info(`[mock] ${what}`);
        return delay(undefined);
    };

    return {
        getProfile: () => (options.failing ? fail() : delay(profile)),
        saveProfile: async next => {
            if (next.attributes?.personId?.[0] !== profile.attributes?.personId?.[0]) {
                throw new ProfileValidationError([{ field: "personId", errorMessage: "error-user-attribute-read-only" }]);
            }
            profile = { ...next, userProfileMetadata: profile.userProfileMetadata };
            await delay(undefined);
        },
        getCredentials: () => (options.failing ? fail() : delay(credentials)),
        getDevices: () => (options.failing ? fail() : delay(options.empty ? [] : devices)),
        deleteSession: log("deleteSession"),
        getGroups: () => (options.failing ? fail() : delay(options.empty ? [] : groups)),
        getApplications: () => (options.failing ? fail() : delay(options.empty ? [] : applications)),
        deleteConsent: log("deleteConsent"),
        requestAction: action => log(`requestAction ${action}`)(),
        logout: log("logout"),
        getCard: () => (options.failing ? fail() : delay(card)),
        issueGoogleWallet: async () => {
            await delay(undefined, 800);
            if (options.cardError) {
                throw new CardApiError(options.cardError === "GOOGLE_WALLET_UNAVAILABLE" ? 502 : 409, options.cardError);
            }
            const issuedAt = new Date().toISOString();
            card = { ...card, status: "ACTIVE", version: 1, issuedAt, wallets: [{ provider: "GOOGLE", status: "ACTIVE", issuedAt }] };
            // Storybook: não sai do Storybook (o link real abre o Google Wallet).
            return { saveUrl: "#google-wallet-simulado" };
        }
    };
}
