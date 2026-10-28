import { defineConfig, devices } from "@playwright/test";

/**
 * Testes ponta a ponta contra um Keycloak real com o tema instalado (VM dev).
 *
 *   E2E_BASE_URL=https://20.55.92.104 E2E_USERNAME=... E2E_PASSWORD=... npm run test:e2e
 *
 * O usuário de teste precisa existir no realm cecairbar com personId preenchido.
 * E2E_IGNORE_HTTPS_ERRORS=true só para o certificado autoassinado da dev.
 */
export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    fullyParallel: false,
    workers: 1,
    reporter: [["list"]],
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "https://20.55.92.104",
        ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "true",
        locale: "pt-BR",
        trace: "retain-on-failure"
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"] } },
        { name: "celular", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } }
    ]
});
