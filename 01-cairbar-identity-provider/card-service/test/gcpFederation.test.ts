import { describe, expect, it, vi } from "vitest";
import { PROVIDER_PATTERN } from "../src/gcpFederation.js";
import { createClientCredentialsToken } from "../src/keycloak.js";

describe("Workload Identity Federation", () => {
    it("aceita só o nome completo do provedor do pool", () => {
        expect(PROVIDER_PATTERN.test("projects/123456789/locations/global/workloadIdentityPools/cecairbar-dev/providers/keycloak")).toBe(true);
        for (const value of [
            "//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/cecairbar-dev/providers/keycloak",
            "projects/meu-projeto/locations/global/workloadIdentityPools/cecairbar-dev/providers/keycloak",
            "projects/123456789/locations/global/workloadIdentityPools/cecairbar-dev"
        ]) {
            expect(PROVIDER_PATTERN.test(value)).toBe(false);
        }
    });

    it("obtém o token do realm por Client Credentials e o reaproveita até perto de expirar", async () => {
        const fetch = vi.fn(async () => Response.json({ access_token: "eyJ.token", expires_in: 300 }));
        const token = createClientCredentialsToken({
            internalUrl: "http://127.0.0.1:8180",
            realm: "cecairbar",
            clientId: "servico-carteirinha-gcp",
            clientSecret: "segredo",
            fetch
        });

        expect(await token()).toBe("eyJ.token");
        expect(await token()).toBe("eyJ.token");
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("http://127.0.0.1:8180/realms/cecairbar/protocol/openid-connect/token");
        // Client Credentials, nunca ROPC (seção 8.2).
        expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
            grant_type: "client_credentials",
            client_id: "servico-carteirinha-gcp",
            client_secret: "segredo"
        });
    });
});
