import { generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../src/auth.js";
import { AUDIENCE, createDpopKey, createTestIssuer, ISSUER } from "./helpers.js";

const CARD_URL = "https://kc.example.test/api/v1/cards/PER-00000001";

/** Seção 20.3: token expirado, issuer errado, audience errada e assinatura inválida. */
describe("validação do access token", async () => {
    const { token, verifyToken } = await createTestIssuer();
    const bearer = (jwt: string) => `Bearer ${jwt}`;
    const request = (authorization: string | undefined) => ({ authorization, dpop: undefined, method: "GET", url: CARD_URL });
    const rejects = (authorization: string | undefined) =>
        expect(verifyToken(request(authorization))).rejects.toBeInstanceOf(AuthenticationError);

    it("aceita token válido e extrai sub, person_id e azp", async () => {
        await expect(verifyToken(request(bearer(await token())))).resolves.toEqual({
            subject: "user-1",
            personId: "PER-00000001",
            clientId: "account-console"
        });
    });

    it("rejeita requisição sem token ou com esquema diferente de Bearer", async () => {
        await rejects(undefined);
        await rejects(`Basic ${Buffer.from("a:b").toString("base64")}`);
    });

    it("rejeita token expirado", async () => {
        await rejects(bearer(await token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 })));
    });

    it("rejeita issuer errado", async () => {
        await rejects(bearer(await token({ iss: "https://kc.example.test/realms/master" })));
    });

    it("rejeita audience errada", async () => {
        await rejects(bearer(await token({ aud: "account" })));
    });

    it("rejeita token assinado por outra chave", async () => {
        const other = await generateKeyPair("RS256");
        await rejects(bearer(await token({}, { key: other.privateKey })));
    });

    it("rejeita token sem assinatura (alg none)", async () => {
        const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
        const payload = Buffer.from(
            JSON.stringify({ iss: ISSUER, aud: AUDIENCE, sub: "user-1", exp: 9999999999, typ: "Bearer", azp: "account-console", person_id: "PER-00000001" })
        ).toString("base64url");
        await rejects(bearer(`${header}.${payload}.`));
    });

    it("rejeita token simétrico (HS256) mesmo com claims corretas", async () => {
        const jwt = await new SignJWT({ typ: "Bearer", azp: "account-console", person_id: "PER-00000001" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer(ISSUER)
            .setAudience(AUDIENCE)
            .setSubject("user-1")
            .setExpirationTime("5m")
            .sign(new TextEncoder().encode("segredo-qualquer-com-32-caracteres!!"));
        await rejects(bearer(jwt));
    });

    it("rejeita ID token e tokens de clientes não autorizados", async () => {
        await rejects(bearer(await token({ typ: "ID" })));
        await rejects(bearer(await token({ azp: "outro-cliente" })));
    });

    it("rejeita token sem person_id ou com person_id malformado", async () => {
        await rejects(bearer(await token({ person_id: undefined })));
        await rejects(bearer(await token({ person_id: "PER-1" })));
        await rejects(bearer(await token({ person_id: "maria@example.org" })));
    });
});

/** Token do portal vinculado à chave do navegador (oidc-spa com DPoP, RFC 9449). */
describe("token DPoP", async () => {
    const { token, verifyToken } = await createTestIssuer();
    const browser = await createDpopKey();
    const dpopToken = () => token({ typ: "DPoP", cnf: { jkt: browser.jkt } });
    const request = (accessToken: string, dpop: string | undefined, scheme = "DPoP") => ({
        authorization: `${scheme} ${accessToken}`,
        dpop,
        method: "POST",
        url: `${CARD_URL}/issue/google`
    });
    const rejects = (req: ReturnType<typeof request>) => expect(verifyToken(req)).rejects.toBeInstanceOf(AuthenticationError);
    const proof = (accessToken: string, overrides: Parameters<typeof browser.proof>[1] | object = {}) =>
        browser.proof(accessToken, { method: "POST", url: `${CARD_URL}/issue/google`, ...overrides });

    it("aceita token vinculado com prova válida (query string fora do htu)", async () => {
        const jwt = await dpopToken();
        await expect(verifyToken(request(jwt, await proof(jwt)))).resolves.toMatchObject({ personId: "PER-00000001" });
        await expect(verifyToken({ ...request(jwt, await proof(jwt)), url: `${CARD_URL}/issue/google?x=1` })).resolves.toBeDefined();
    });

    it("rejeita token vinculado apresentado como Bearer ou sem prova", async () => {
        const jwt = await dpopToken();
        await rejects(request(jwt, await proof(jwt), "Bearer"));
        await rejects(request(jwt, undefined));
        await rejects(request(jwt, "nao-e-jwt"));
    });

    it("rejeita esquema DPoP com token sem vínculo", async () => {
        const jwt = await token();
        await rejects(request(jwt, await proof(jwt)));
    });

    it("rejeita prova de outra chave", async () => {
        const jwt = await dpopToken();
        const other = await createDpopKey();
        await rejects(request(jwt, await other.proof(jwt, { method: "POST", url: `${CARD_URL}/issue/google` })));
    });

    it("rejeita prova para outro método, outra URL ou outro token", async () => {
        const jwt = await dpopToken();
        await rejects(request(jwt, await proof(jwt, { method: "GET" })));
        await rejects(request(jwt, await proof(jwt, { url: "https://kc.example.test/api/v1/cards/PER-00000002/issue/google" })));
        await rejects(request(jwt, await proof(await token({ typ: "DPoP", cnf: { jkt: browser.jkt }, jti: "outro" }))));
    });

    it("rejeita prova antiga e prova repetida (replay)", async () => {
        const jwt = await dpopToken();
        await rejects(request(jwt, await proof(jwt, { iat: Math.floor(Date.now() / 1000) - 120 })));
        const once = await proof(jwt, { jti: "fixo" });
        await expect(verifyToken(request(jwt, once))).resolves.toBeDefined();
        await rejects(request(jwt, once));
    });
});
