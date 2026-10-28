import { qrValue } from "./personId.js";

/**
 * Passe genérico do Google Wallet (Generic pass). Fluxo recomendado pelo Google:
 * o objeto é criado/atualizado pela API REST e o botão "Salvar no Google Wallet" leva um
 * JWT curto que só referencia o ID do objeto.
 * Docs: https://developers.google.com/wallet/generic
 */

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
export const WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const SAVE_URL = "https://pay.google.com/gp/v/save/";

export type CardPass = {
    personId: string;
    /** Nome de preferência (seção 9.2) — único dado pessoal enviado ao Google além do personId. */
    displayName: string;
    version: number;
};

export type GooglePassSettings = {
    issuerId: string;
    environment: string;
    issuerName: string;
    backgroundColor: string;
    /**
     * URL pública (HTTPS com certificado válido) de onde o Google baixa logo.png, wide-logo.png e
     * hero.png: o bucket de ansible/scripts/gcp-wallet-assets.sh ou /api/v1/cards/assets. Sem ela o
     * passe sai sem imagens.
     */
    assetsBaseUrl?: string;
    contactText?: string;
};

export type GoogleWallet = {
    /** Cria ou atualiza o objeto do passe; devolve o ID do objeto no Google. */
    upsertPass: (pass: CardPass) => Promise<string>;
    saveUrl: (objectId: string) => Promise<string>;
};

const localized = (value: string) => ({ defaultValue: { language: "pt-BR", value } });

export function classId(settings: GooglePassSettings): string {
    return `${settings.issuerId}.cecairbar-carteirinha-${settings.environment}`;
}

export function objectId(settings: GooglePassSettings, pass: Pick<CardPass, "personId" | "version">): string {
    return `${settings.issuerId}.${settings.environment}-${pass.personId}-v${pass.version}`;
}

/** Campo do objeto exibido na frente do passe. */
const textField = (id: string) => ({ firstValue: { fields: [{ fieldPath: `object.textModulesData['${id}']` }] } });

const image = (settings: GooglePassSettings, file: string, description: string) =>
    settings.assetsBaseUrl
        ? { sourceUri: { uri: `${settings.assetsBaseUrl.replace(/\/$/, "")}/${file}` }, contentDescription: localized(description) }
        : undefined;

export function buildGenericClass(settings: GooglePassSettings) {
    return {
        id: classId(settings),
        issuerName: settings.issuerName,
        // Frente igual à do cartão do portal: nome (header), identificador e situação.
        classTemplateInfo: {
            cardTemplateOverride: {
                cardRowTemplateInfos: [{ twoItems: { startItem: textField("identificador"), endItem: textField("situacao") } }]
            }
        },
        // Um titular por passe (em todos os aparelhos dele): dificulta repassar a carteirinha.
        multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
        // Brilho animado sobre o QR, para diferenciar o passe de uma captura de tela (seção 15.3).
        securityAnimation: { animationType: "FOIL_SHIMMER" }
    };
}

export function buildGenericObject(settings: GooglePassSettings, pass: CardPass) {
    const qr = qrValue(pass.personId);
    const textModulesData = [
        { id: "identificador", header: "Identificador", body: pass.personId },
        // O objeto só é gravado ACTIVE hoje. TODO: suspensão/revogação (seção 11.1) atualizam state e este texto.
        { id: "situacao", header: "Situação", body: "Ativa" }
    ];
    if (settings.contactText) {
        textModulesData.push({ id: "contato", header: "Encontrou esta carteirinha?", body: settings.contactText });
    }
    // wideLogo (logotipo horizontal) substitui o círculo no topo do passe; logo segue para as
    // telas que só mostram o círculo. O hero repete as faixas do cartão do portal.
    const logo = image(settings, "logo.png", settings.issuerName);
    const wideLogo = image(settings, "wide-logo.png", `Logotipo do ${settings.issuerName}`);
    const heroImage = image(settings, "hero.png", "Faixas decorativas");
    return {
        id: objectId(settings, pass),
        classId: classId(settings),
        state: "ACTIVE",
        cardTitle: localized(settings.issuerName),
        subheader: localized("Nome"),
        header: localized(pass.displayName || pass.personId),
        hexBackgroundColor: settings.backgroundColor,
        ...(logo && { logo }),
        ...(wideLogo && { wideLogo }),
        ...(heroImage && { heroImage }),
        // O QR leva só a referência (regra 3); o texto alternativo repete o personId legível.
        barcode: { type: "QR_CODE", value: qr, alternateText: pass.personId },
        textModulesData
        // TODO(seção 23.6): foto — não incluída até haver decisão.
    };
}

/** Conta de serviço do Google Wallet, sem chave local (implementação em gcpFederation.ts). */
export type WalletCredentials = {
    serviceAccountEmail: string;
    /** Requisição autenticada como a conta de serviço; não lança em respostas HTTP de erro. */
    request: (request: { url: string; method: "GET" | "POST" | "PUT"; data?: unknown }) => Promise<{ status: number; data: unknown }>;
    /** Assina as claims (RS256) com uma chave da conta de serviço gerenciada pelo Google. */
    signJwt: (claims: Record<string, unknown>) => Promise<string>;
};

export type GoogleWalletOptions = GooglePassSettings & {
    credentials: WalletCredentials;
    /** Origens autorizadas a exibir o botão (domínio do portal). */
    origins: string[];
};

export class GoogleWalletError extends Error {
    constructor(
        message: string,
        readonly status?: number
    ) {
        super(message);
    }
}

/** Motivo devolvido pela API ({ error: { message } }), para o log; o corpo do passe não é repetido. */
function reason(data: unknown): string {
    const message = (data as { error?: { message?: unknown } } | undefined)?.error?.message;
    return typeof message === "string" ? `: ${message.slice(0, 300)}` : "";
}

function failure(what: string, response: { status: number; data: unknown }): GoogleWalletError {
    return new GoogleWalletError(`Google Wallet: falha ao ${what} (HTTP ${response.status})${reason(response.data)}`, response.status);
}

export function createGoogleWallet(options: GoogleWalletOptions): GoogleWallet {
    const { credentials } = options;

    async function call(method: "GET" | "POST" | "PUT", path: string, data?: unknown) {
        try {
            return await credentials.request({ url: `${API}${path}`, method, data });
        } catch (error) {
            throw new GoogleWalletError(`Google Wallet indisponível: ${(error as Error).message}`);
        }
    }

    let classReady: Promise<void> | undefined;

    // Classe criada uma vez por processo; reenviada se o processo reiniciar (atualiza a configuração).
    function ensureClass(): Promise<void> {
        classReady ??= (async () => {
            const body = buildGenericClass(options);
            const existing = await call("GET", `/genericClass/${body.id}`);
            // Só 404 significa "classe ainda não existe"; outro erro (403...) não pode virar PUT.
            if (existing.status >= 300 && existing.status !== 404) {
                throw failure("ler a classe", existing);
            }
            const response =
                existing.status === 404
                    ? await call("POST", "/genericClass", body)
                    : await call("PUT", `/genericClass/${body.id}`, { ...(existing.data as object), ...body });
            if (response.status >= 300) {
                throw failure("gravar a classe", response);
            }
        })().catch(error => {
            classReady = undefined;
            throw error;
        });
        return classReady;
    }

    return {
        async upsertPass(pass) {
            await ensureClass();
            const body = buildGenericObject(options, pass);
            let response = await call("POST", "/genericObject", body);
            if (response.status === 409) {
                response = await call("PUT", `/genericObject/${body.id}`, body);
            }
            if (response.status >= 300) {
                throw failure("gravar o passe", response);
            }
            return body.id;
        },

        async saveUrl(id) {
            try {
                const jwt = await credentials.signJwt({
                    iss: credentials.serviceAccountEmail,
                    aud: "google",
                    iat: Math.floor(Date.now() / 1000),
                    typ: "savetowallet",
                    origins: options.origins,
                    payload: { genericObjects: [{ id }] }
                });
                return SAVE_URL + jwt;
            } catch (error) {
                throw new GoogleWalletError(`Google Wallet: falha ao assinar o link (${(error as Error).message})`);
            }
        }
    };
}
