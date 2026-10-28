import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import { AuthenticationError, DPOP_ALGORITHMS, type Principal, type TokenVerifier } from "./auth.js";
import { CardError, type CardService } from "./cardService.js";
import { PERSON_ID_PATTERN } from "./personId.js";

declare module "fastify" {
    interface FastifyRequest {
        principal: Principal;
    }
}

export type AppDeps = {
    verifyToken: TokenVerifier;
    cards: CardService;
    /** Verificação de prontidão (ex.: banco). */
    ready?: () => Promise<void>;
    logger?: FastifyServerOptions["logger"];
};

const CORRELATION_ID = /^[A-Za-z0-9._-]{1,64}$/;

// card-service/assets, tanto de src/ (tsx) quanto de dist/.
const ASSETS_DIR = new URL("../assets/", import.meta.url);
const WALLET_ASSETS: readonly string[] = ["logo.png", "wide-logo.png", "hero.png"];

const personParams = {
    type: "object",
    required: ["personId"],
    properties: { personId: { type: "string", pattern: PERSON_ID_PATTERN.source } }
} as const;

export function buildApp({ verifyToken, cards, ready, logger = true }: AppDeps) {
    const app = Fastify({
        // Logs JSON (RNF-006). O serializador padrão de requisição não inclui cabeçalhos
        // (Authorization) nem corpo; respostas não são registradas (o link do Google Wallet
        // dá acesso ao passe).
        logger,
        logController: new LogController({
            requestIdLogLabel: "correlation_id",
            disableRequestLogging: request => request.url === "/health"
        }),
        // Reaproveita o X-Request-ID do nginx (ou do cliente, se bem formado).
        genReqId: request => {
            const header = request.headers["x-request-id"];
            return typeof header === "string" && CORRELATION_ID.test(header) ? header : randomUUID();
        },
        trustProxy: "127.0.0.1"
    });

    app.decorateRequest("principal", undefined as unknown as Principal);

    app.addHook("onSend", async (request, reply) => {
        reply.header("x-request-id", request.id);
        if (!reply.hasHeader("cache-control")) {
            reply.header("cache-control", "no-store");
        }
    });

    app.setErrorHandler((error, request, reply) => {
        const body = (status: number, code: string, message: string) =>
            reply.status(status).send({ code, message, correlationId: request.id });

        if (error instanceof AuthenticationError) {
            // O motivo exato (expirado, issuer, audience...) só vai para o log.
            request.log.info({ reason: error.message }, "token rejeitado");
            reply.header("www-authenticate", `Bearer error="invalid_token", DPoP error="invalid_token", algs="${DPOP_ALGORITHMS.join(" ")}"`);
            return body(401, "UNAUTHORIZED", "Token ausente ou inválido");
        }
        if (error instanceof CardError) {
            if (error.status >= 500) {
                request.log.error({ err: error.cause ?? error }, error.message);
            }
            return body(error.status, error.code, error.message);
        }
        const fastifyError = error as { validation?: unknown; statusCode?: number };
        if (fastifyError.validation) {
            return body(400, "INVALID_REQUEST", "Requisição inválida");
        }
        if (fastifyError.statusCode !== undefined && fastifyError.statusCode < 500) {
            return body(fastifyError.statusCode, "INVALID_REQUEST", "Requisição inválida");
        }
        request.log.error({ err: error }, "erro inesperado");
        return body(500, "INTERNAL_ERROR", "Erro interno");
    });

    // Só no loopback: o nginx publica apenas /api/v1/cards/.
    app.get("/health", async () => {
        await ready?.();
        return { status: "UP" };
    });

    // Imagens do passe (scripts/gerar-imagens-wallet.py), baixadas pelo Google sem token: só a
    // marca, nenhum dado pessoal.
    app.get<{ Params: { name: string } }>("/api/v1/cards/assets/:name", async (request, reply) => {
        if (!WALLET_ASSETS.includes(request.params.name)) {
            return reply.status(404).send({ code: "NOT_FOUND", message: "Recurso não encontrado", correlationId: request.id });
        }
        const file = await readFile(new URL(request.params.name, ASSETS_DIR));
        return reply.header("cache-control", "public, max-age=86400").type("image/png").send(file);
    });

    app.register(
        async api => {
            api.addHook("onRequest", async request => {
                // Esquema e host públicos vêm do nginx (X-Forwarded-Proto/Host, trustProxy).
                request.principal = await verifyToken({
                    authorization: request.headers.authorization,
                    dpop: request.headers.dpop,
                    method: request.method,
                    url: `${request.protocol}://${request.host}${request.url}`
                });
            });

            api.get<{ Params: { personId: string } }>("/:personId", { schema: { params: personParams } }, request =>
                cards.getCard(request.principal, request.params.personId)
            );

            api.post<{ Params: { personId: string } }>(
                "/:personId/issue/google",
                { schema: { params: personParams } },
                request => cards.issueGoogle(request.principal, request.params.personId, request.id)
            );

            // TODO: POST /:personId/issue/apple (passo seguinte) e suspend/reactivate/revoke/reissue
            // para operadores (seção 11.1; roles em aberto, seção 23.5).
        },
        { prefix: "/api/v1/cards" }
    );

    return app;
}
