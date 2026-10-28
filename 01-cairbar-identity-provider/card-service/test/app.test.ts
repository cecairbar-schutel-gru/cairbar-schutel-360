import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createCardService } from "../src/cardService.js";
import type { Identity } from "../src/keycloak.js";
import { createDpopKey, createTestIssuer, fakeGoogleWallet, memoryDirectory, memoryRepository } from "./helpers.js";

const issuer = await createTestIssuer();

function identity(overrides: Partial<Identity> = {}): Identity {
    return { personId: "PER-00000001", displayName: "Maria Exemplo", identityStatus: "ACTIVE", cardStatus: "NOT_ISSUED", ...overrides };
}

function setup(options: { user?: Identity; googleFails?: boolean } = {}) {
    const logs: string[] = [];
    const stream = new Writable({
        write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
        }
    });
    const repo = memoryRepository();
    const dir = memoryDirectory({ "user-1": options.user ?? identity() });
    const google = fakeGoogleWallet({ fail: options.googleFails });
    const app = buildApp({
        verifyToken: issuer.verifyToken,
        cards: createCardService({ repository: repo.repository, directory: dir.directory, googleWallet: google.googleWallet }),
        logger: { level: "debug", stream }
    });
    return { app, repo, dir, google, logs };
}

async function issue(app: ReturnType<typeof setup>["app"], personId = "PER-00000001", jwt?: string) {
    return app.inject({
        method: "POST",
        url: `/api/v1/cards/${personId}/issue/google`,
        headers: { authorization: `Bearer ${jwt ?? (await issuer.token())}` }
    });
}

describe("POST /api/v1/cards/{personId}/issue/google", () => {
    it("emite a carteirinha da própria pessoa e devolve o link do Google Wallet", async () => {
        const { app, repo, dir, google } = setup();
        const response = await issue(app);

        expect(response.statusCode).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const body = response.json();
        expect(body.saveUrl).toBe("https://pay.google.com/gp/v/save/jwt-for-3388000000000000000.dev-PER-00000001-v1");
        expect(body.card).toMatchObject({ personId: "PER-00000001", status: "ACTIVE", version: 1, wallets: [{ provider: "GOOGLE", status: "ACTIVE" }] });
        expect(google.passes).toEqual([{ personId: "PER-00000001", displayName: "Maria Exemplo", version: 1 }]);
        expect(dir.updates).toEqual([{ userId: "user-1", status: "ACTIVE" }]);
        expect(repo.events).toMatchObject([{ action: "CARD_ISSUE_GOOGLE_WALLET", result: "SUCCESS", actorId: "user-1", targetId: "PER-00000001" }]);
    });

    it("trata emissão repetida sem duplicar a carteirinha (US-003)", async () => {
        const { app, repo, google } = setup();
        await issue(app);
        const second = await issue(app);

        expect(second.statusCode).toBe(200);
        expect(repo.cards.size).toBe(1);
        expect(repo.wallets.size).toBe(1);
        expect(second.json().card.version).toBe(1);
        expect(google.passes).toHaveLength(2);
    });

    it("exige token (401) e não revela o motivo da rejeição", async () => {
        const { app } = setup();
        const missing = await app.inject({ method: "POST", url: "/api/v1/cards/PER-00000001/issue/google" });
        expect(missing.statusCode).toBe(401);
        expect(missing.headers["www-authenticate"]).toContain("Bearer");

        const expired = await issue(app, "PER-00000001", await issuer.token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }));
        expect(expired.statusCode).toBe(401);
        expect(expired.json()).toMatchObject({ code: "UNAUTHORIZED", message: "Token ausente ou inválido" });
    });

    it("aceita token DPoP do portal, com o htu na URL pública vista pelo nginx", async () => {
        const { app } = setup();
        const browser = await createDpopKey();
        const jwt = await issuer.token({ typ: "DPoP", cnf: { jkt: browser.jkt } });
        const path = "/api/v1/cards/PER-00000001/issue/google";
        const send = async (url: string) =>
            app.inject({
                method: "POST",
                url: path,
                headers: {
                    authorization: `DPoP ${jwt}`,
                    dpop: await browser.proof(jwt, { method: "POST", url }),
                    "x-forwarded-proto": "https",
                    "x-forwarded-host": "portal.example.test"
                }
            });

        expect((await send(`https://portal.example.test${path}`)).statusCode).toBe(200);
        expect((await send(`http://portal.example.test${path}`)).statusCode).toBe(401);
    });

    it("impede emitir para outra pessoa, com a mesma resposta exista ou não o ID (enumeração)", async () => {
        const { app, repo, google } = setup();
        repo.cards.set("PER-00000002", { id: "c2", personId: "PER-00000002", status: "ACTIVE", version: 1, issuedAt: new Date() });

        const existing = await issue(app, "PER-00000002");
        const unknown = await issue(app, "PER-99999999");
        expect(existing.statusCode).toBe(403);
        expect(unknown.statusCode).toBe(403);
        expect({ ...existing.json(), correlationId: "" }).toEqual({ ...unknown.json(), correlationId: "" });
        expect(google.passes).toHaveLength(0);
    });

    it("recusa quando o personId do Keycloak não corresponde ao do token", async () => {
        const { app, repo } = setup({ user: identity({ personId: "PER-00000002" }) });
        const response = await issue(app);
        expect(response.statusCode).toBe(403);
        expect(repo.events).toMatchObject([{ result: "FAILURE", metadata: { reason: "IDENTITY_MISMATCH" } }]);
    });

    it("rejeita personId malformado no caminho (400)", async () => {
        const { app } = setup();
        for (const personId of ["PER-1", "per-00000001", "org:person:PER-00000001", "PER-00000001%27"]) {
            expect((await issue(app, personId)).statusCode).toBe(400);
        }
    });

    it("exige identidade ativa (seção 12.2)", async () => {
        for (const identityStatus of ["SUSPENDED", "INACTIVE", undefined]) {
            const { app, google, dir } = setup({ user: identity({ identityStatus }) });
            const response = await issue(app);
            expect(response.statusCode).toBe(409);
            expect(response.json().code).toBe("IDENTITY_NOT_ACTIVE");
            expect(google.passes).toHaveLength(0);
            expect(dir.updates).toHaveLength(0);
        }
    });

    it("não permite auto-emissão de carteirinha suspensa ou revogada", async () => {
        for (const cardStatus of ["SUSPENDED", "REVOKED"]) {
            const { app, google } = setup({ user: identity({ cardStatus }) });
            const response = await issue(app);
            expect(response.statusCode).toBe(409);
            expect(response.json().code).toBe("CARD_BLOCKED");
            expect(google.passes).toHaveLength(0);
        }

        const { app, repo } = setup();
        repo.cards.set("PER-00000001", { id: "c1", personId: "PER-00000001", status: "REVOKED", version: 1, issuedAt: new Date() });
        expect((await issue(app)).json().code).toBe("CARD_BLOCKED");
    });

    it("devolve 502 e não altera o cardStatus quando o Google Wallet falha", async () => {
        const { app, dir, repo } = setup({ googleFails: true });
        const response = await issue(app);
        expect(response.statusCode).toBe(502);
        expect(response.json().code).toBe("GOOGLE_WALLET_UNAVAILABLE");
        expect(dir.updates).toHaveLength(0);
        expect(repo.events).toMatchObject([{ result: "FAILURE", metadata: { reason: "GOOGLE_WALLET_ERROR" } }]);
    });

    it("propaga o correlation ID e não registra token, nome nem link do passe nos logs", async () => {
        const { app, logs, repo } = setup();
        const jwt = await issuer.token();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/cards/PER-00000001/issue/google",
            headers: { authorization: `Bearer ${jwt}`, "x-request-id": "req-123" }
        });
        await issue(app, "PER-00000001", await issuer.token({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 }));

        expect(response.headers["x-request-id"]).toBe("req-123");
        expect(repo.events[0]?.correlationId).toBe("req-123");
        const output = logs.join("");
        expect(output).toContain('"correlation_id":"req-123"');
        expect(output).not.toContain(jwt);
        expect(output).not.toContain("Maria");
        expect(output).not.toContain("pay.google.com");
        expect(output).not.toMatch(/authorization/i);
    });

    it("ignora X-Request-ID malformado", async () => {
        const { app } = setup();
        const response = await app.inject({
            method: "POST",
            url: "/api/v1/cards/PER-00000001/issue/google",
            headers: { authorization: `Bearer ${await issuer.token()}`, "x-request-id": "<script>" }
        });
        expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    });
});

describe("GET /api/v1/cards/{personId}", () => {
    it("mostra NOT_ISSUED antes da emissão e ACTIVE com o Google depois", async () => {
        const { app } = setup();
        const headers = { authorization: `Bearer ${await issuer.token()}` };
        expect((await app.inject({ url: "/api/v1/cards/PER-00000001", headers })).json()).toEqual({
            personId: "PER-00000001",
            status: "NOT_ISSUED",
            version: null,
            issuedAt: null,
            wallets: []
        });
        await issue(app);
        expect((await app.inject({ url: "/api/v1/cards/PER-00000001", headers })).json()).toMatchObject({
            status: "ACTIVE",
            wallets: [{ provider: "GOOGLE", status: "ACTIVE" }]
        });
    });

    it("não consulta a carteirinha de outra pessoa", async () => {
        const { app } = setup();
        const response = await app.inject({ url: "/api/v1/cards/PER-00000002", headers: { authorization: `Bearer ${await issuer.token()}` } });
        expect(response.statusCode).toBe(403);
    });
});

describe("GET /api/v1/cards/assets/{nome}", () => {
    it("serve as imagens do passe sem token e com cache, para o Google baixá-las", async () => {
        const { app } = setup();
        for (const name of ["logo.png", "wide-logo.png", "hero.png"]) {
            const response = await app.inject({ method: "GET", url: `/api/v1/cards/assets/${name}` });
            expect(response.statusCode).toBe(200);
            expect(response.headers["content-type"]).toBe("image/png");
            expect(response.headers["cache-control"]).toBe("public, max-age=86400");
            expect(response.rawPayload.subarray(1, 4).toString()).toBe("PNG");
        }
    });

    it("só serve as imagens conhecidas (sem acesso a outros arquivos)", async () => {
        const { app } = setup();
        for (const url of ["/api/v1/cards/assets/outro.png", "/api/v1/cards/assets/..%2Fpackage.json", "/api/v1/cards/assets/%2E%2E%2Fsrc%2Fapp.ts"]) {
            const response = await app.inject({ method: "GET", url });
            expect(response.statusCode).toBe(404);
            expect(response.headers["cache-control"]).toBe("no-store");
        }
    });
});
