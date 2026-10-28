import { createHash } from "node:crypto";
import { calculateJwkThumbprint, createRemoteJWKSet, EmbeddedJWK, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { isPersonId } from "./personId.js";

/** Titular autenticado, extraído de um access token válido do Keycloak. */
export type Principal = {
    /** ID do usuário no Keycloak (sub). */
    subject: string;
    /** Claim person_id (seção 8.6). */
    personId: string;
    /** Cliente que obteve o token (azp). */
    clientId: string;
};

export class AuthenticationError extends Error {}

export type TokenVerifierOptions = {
    issuer: string;
    audience: string;
    allowedClients: string[];
    keys: JWTVerifyGetKey;
};

/** O que a validação precisa da requisição HTTP. */
export type AuthRequest = {
    authorization: string | undefined;
    /** Cabeçalho DPoP (prova de posse da chave, RFC 9449). */
    dpop: string | string[] | undefined;
    method: string;
    /** URL pública da requisição (esquema e host vistos pelo cliente, antes do nginx). */
    url: string;
};

export type TokenVerifier = (request: AuthRequest) => Promise<Principal>;

/** JWKS do realm lido pela URL interna (o issuer público passa pelo nginx). */
export function remoteKeys(internalUrl: string, realm: string): JWTVerifyGetKey {
    return createRemoteJWKSet(new URL(`${internalUrl}/realms/${realm}/protocol/openid-connect/certs`));
}

const AUTHORIZATION = /^(Bearer|DPoP) ([A-Za-z0-9._-]+)$/;
const COMPACT_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const DPOP_ALGORITHMS = ["ES256", "ES384", "PS256", "RS256", "EdDSA"];
const PROOF_MAX_AGE_SECONDS = 60;
const CLOCK_TOLERANCE_SECONDS = 5;

/** Origem e caminho, sem query nem fragmento (htu, RFC 9449 seção 4.3). */
function htu(url: string): string | undefined {
    try {
        const parsed = new URL(url);
        return parsed.origin + parsed.pathname;
    } catch {
        return undefined;
    }
}

/**
 * jti das provas já aceitas, até expirarem. Em memória: o serviço roda em um único processo
 * (carteirinha.service); com mais instâncias, mover para um armazenamento compartilhado.
 */
function createReplayCache() {
    const seen = new Map<string, number>();
    return (key: string, expiresAt: number) => {
        const now = Date.now();
        for (const [k, expiry] of seen) {
            if (expiry <= now) {
                seen.delete(k);
            }
        }
        if (seen.has(key)) {
            return false;
        }
        seen.set(key, expiresAt);
        return true;
    };
}

/**
 * Valida assinatura, issuer, audience e expiração no backend (regra 6). Só aceita access
 * tokens emitidos para os clientes autorizados e com person_id bem formado.
 *
 * O portal (oidc-spa) usa DPoP: o token vem vinculado à chave do navegador (cnf.jkt) e chega como
 * "Authorization: DPoP <token>" com uma prova assinada no cabeçalho DPoP. Token vinculado só é
 * aceito com prova válida; sem vínculo, só como Bearer.
 */
export function createTokenVerifier({ issuer, audience, allowedClients, keys }: TokenVerifierOptions): TokenVerifier {
    const firstUse = createReplayCache();

    async function verifyProof(request: AuthRequest, accessToken: string, jkt: string) {
        const proof = request.dpop;
        if (typeof proof !== "string" || !COMPACT_JWT.test(proof)) {
            throw new AuthenticationError("Prova DPoP ausente");
        }
        const { payload, protectedHeader } = await jwtVerify(proof, EmbeddedJWK, {
            typ: "dpop+jwt",
            algorithms: DPOP_ALGORITHMS,
            requiredClaims: ["jti", "htm", "htu", "iat"],
            maxTokenAge: PROOF_MAX_AGE_SECONDS,
            clockTolerance: CLOCK_TOLERANCE_SECONDS
        });
        if ((await calculateJwkThumbprint(protectedHeader.jwk!)) !== jkt) {
            throw new AuthenticationError("Prova DPoP de outra chave");
        }
        if (payload.htm !== request.method || typeof payload.htu !== "string" || htu(payload.htu) !== htu(request.url)) {
            throw new AuthenticationError("Prova DPoP para outra requisição");
        }
        if (payload.ath !== createHash("sha256").update(accessToken).digest("base64url")) {
            throw new AuthenticationError("Prova DPoP de outro token");
        }
        const expiresAt = (payload.iat! + PROOF_MAX_AGE_SECONDS + CLOCK_TOLERANCE_SECONDS) * 1000;
        if (typeof payload.jti !== "string" || !firstUse(`${jkt}:${payload.jti}`, expiresAt)) {
            throw new AuthenticationError("Prova DPoP repetida");
        }
    }

    return async request => {
        const match = AUTHORIZATION.exec(request.authorization ?? "");
        if (!match) {
            throw new AuthenticationError("Token ausente");
        }
        const [, scheme, accessToken] = match as unknown as [string, "Bearer" | "DPoP", string];
        try {
            const { payload } = await jwtVerify(accessToken, keys, {
                issuer,
                audience,
                algorithms: ["RS256", "PS256", "ES256"],
                requiredClaims: ["exp", "sub"],
                clockTolerance: CLOCK_TOLERANCE_SECONDS
            });
            // O Keycloak marca o access token vinculado com typ DPoP.
            if (payload.typ !== "Bearer" && payload.typ !== "DPoP") {
                throw new AuthenticationError("Não é um access token");
            }
            const jkt = (payload.cnf as { jkt?: unknown } | undefined)?.jkt;
            if (typeof jkt === "string") {
                if (scheme !== "DPoP") {
                    throw new AuthenticationError("Token DPoP apresentado como Bearer");
                }
                await verifyProof(request, accessToken, jkt);
            } else if (scheme !== "Bearer") {
                throw new AuthenticationError("Token sem vínculo DPoP");
            }
            if (typeof payload.azp !== "string" || !allowedClients.includes(payload.azp)) {
                throw new AuthenticationError("Cliente não autorizado");
            }
            if (!isPersonId(payload.person_id)) {
                throw new AuthenticationError("Token sem person_id");
            }
            return { subject: payload.sub!, personId: payload.person_id, clientId: payload.azp };
        } catch (error) {
            if (error instanceof AuthenticationError) {
                throw error;
            }
            if (error instanceof errors.JOSEError) {
                throw new AuthenticationError(error.code);
            }
            throw error;
        }
    };
}
