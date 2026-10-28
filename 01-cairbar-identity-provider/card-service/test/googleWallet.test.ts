import { decodeJwt, decodeProtectedHeader, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { buildGenericClass, buildGenericObject, classId, createGoogleWallet, GoogleWalletError, objectId } from "../src/googleWallet.js";
import { isPersonId, qrValue } from "../src/personId.js";

const settings = {
    issuerId: "3388000000000000000",
    environment: "dev",
    issuerName: "CE Cairbar Schutel Guarulhos",
    backgroundColor: "#FFFFFF"
};

describe("conteúdo do QR Code (seção 9.3)", () => {
    it("contém somente a referência org:person:<personId>", () => {
        expect(qrValue("PER-00000001")).toBe("org:person:PER-00000001");
    });

    it("recusa personId malformado (QR malformado, seção 20.3)", () => {
        for (const value of ["PER-1", "per-00000001", "PER-000000012", "org:person:PER-00000001", "", " PER-00000001"]) {
            expect(isPersonId(value)).toBe(false);
            expect(() => qrValue(value)).toThrow();
        }
    });
});

describe("passe genérico do Google Wallet", () => {
    const pass = { personId: "PER-00000001", displayName: "Maria", version: 1 };

    it("usa IDs com issuer, ambiente, personId e versão", () => {
        expect(classId(settings)).toBe("3388000000000000000.cecairbar-carteirinha-dev");
        expect(objectId(settings, pass)).toBe("3388000000000000000.dev-PER-00000001-v1");
    });

    it("põe no QR só a referência e não envia outros dados pessoais", () => {
        const object = buildGenericObject(settings, pass);
        expect(object.barcode).toEqual({ type: "QR_CODE", value: "org:person:PER-00000001", alternateText: "PER-00000001" });
        expect(object.state).toBe("ACTIVE");
        const json = JSON.stringify(object);
        // Só personId e nome de preferência; nada de e-mail, telefone, nascimento, roles ou tokens.
        expect(json).not.toMatch(/@|birth|nascimento|phone|celular|role|token|eyJ/i);
        expect(object.header.defaultValue.value).toBe("Maria");
    });

    it("usa o personId como título quando não há nome", () => {
        expect(buildGenericObject(settings, { ...pass, displayName: "" }).header.defaultValue.value).toBe("PER-00000001");
    });

    it("mostra na frente nome, identificador e situação, como o cartão do portal", () => {
        const object = buildGenericObject(settings, pass);
        expect(object.subheader.defaultValue.value).toBe("Nome");
        expect(object.textModulesData).toEqual([
            { id: "identificador", header: "Identificador", body: "PER-00000001" },
            { id: "situacao", header: "Situação", body: "Ativa" }
        ]);
        const row = buildGenericClass(settings).classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0]!.twoItems;
        expect(row.startItem.firstValue.fields[0]!.fieldPath).toBe("object.textModulesData['identificador']");
        expect(row.endItem.firstValue.fields[0]!.fieldPath).toBe("object.textModulesData['situacao']");
    });

    it("usa logotipo e imagem de destaque da marca só quando há URL pública", () => {
        expect(buildGenericObject(settings, pass)).not.toHaveProperty("logo");
        expect(buildGenericObject(settings, pass)).not.toHaveProperty("wideLogo");
        expect(buildGenericObject(settings, pass)).not.toHaveProperty("heroImage");

        const object = buildGenericObject({ ...settings, assetsBaseUrl: "https://portal.example.test/api/v1/cards/assets/" }, pass);
        expect(object.logo?.sourceUri.uri).toBe("https://portal.example.test/api/v1/cards/assets/logo.png");
        expect(object.wideLogo?.sourceUri.uri).toBe("https://portal.example.test/api/v1/cards/assets/wide-logo.png");
        expect(object.heroImage?.sourceUri.uri).toBe("https://portal.example.test/api/v1/cards/assets/hero.png");
    });

    it("restringe o passe a um titular e anima o QR contra capturas de tela", () => {
        expect(buildGenericClass(settings)).toMatchObject({
            multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
            securityAnimation: { animationType: "FOIL_SHIMMER" }
        });
    });

    it("gera link de salvamento assinado pela conta de serviço só com o ID do objeto", async () => {
        const { privateKey, publicKey } = await generateKeyPair("RS256");
        // Faz o papel do signJwt da IAM Credentials API: a chave fica no Google, não no serviço.
        const signJwt = vi.fn((claims: Record<string, unknown>) =>
            new SignJWT(claims).setProtectedHeader({ alg: "RS256", typ: "JWT" }).sign(privateKey)
        );
        const request = vi.fn();
        const wallet = createGoogleWallet({
            ...settings,
            credentials: { serviceAccountEmail: "wallet@proj.iam.gserviceaccount.com", request, signJwt },
            origins: ["https://portal.example.test"]
        });

        const url = await wallet.saveUrl("3388000000000000000.dev-PER-00000001-v1");
        expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
        const jwt = url.slice("https://pay.google.com/gp/v/save/".length);
        expect(decodeProtectedHeader(jwt).alg).toBe("RS256");
        await expect(jwtVerify(jwt, publicKey, { issuer: "wallet@proj.iam.gserviceaccount.com", audience: "google" })).resolves.toBeDefined();
        expect(decodeJwt(jwt)).toMatchObject({
            typ: "savetowallet",
            origins: ["https://portal.example.test"],
            payload: { genericObjects: [{ id: "3388000000000000000.dev-PER-00000001-v1" }] }
        });
        expect(request).not.toHaveBeenCalled();
    });

    it("converte falha na assinatura em erro do Google Wallet", async () => {
        const wallet = createGoogleWallet({
            ...settings,
            credentials: {
                serviceAccountEmail: "wallet@proj.iam.gserviceaccount.com",
                request: vi.fn(),
                signJwt: () => Promise.reject(new Error("HTTP 403"))
            },
            origins: ["https://portal.example.test"]
        });
        await expect(wallet.saveUrl("x")).rejects.toBeInstanceOf(GoogleWalletError);
    });

    it("não tenta atualizar a classe quando a leitura falha e registra o motivo do Google", async () => {
        const request = vi.fn().mockResolvedValue({ status: 403, data: { error: { code: 403, message: "The caller does not have permission" } } });
        const wallet = createGoogleWallet({
            ...settings,
            credentials: { serviceAccountEmail: "wallet@proj.iam.gserviceaccount.com", request, signJwt: vi.fn() },
            origins: ["https://portal.example.test"]
        });

        await expect(wallet.upsertPass(pass)).rejects.toThrow(
            "Google Wallet: falha ao ler a classe (HTTP 403): The caller does not have permission"
        );
        expect(request).toHaveBeenCalledTimes(1);
    });
});
