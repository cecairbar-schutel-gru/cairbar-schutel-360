import { expect, type Page } from "@playwright/test";

export const realm = "cecairbar";
export const accountPath = `/realms/${realm}/account/`;

export function credentials() {
    const username = process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;
    if (!username || !password) {
        throw new Error("Defina E2E_USERNAME e E2E_PASSWORD (usuário de teste do realm cecairbar).");
    }
    return { username, password };
}

/** Abre o portal, passa pelo login do tema e espera a tela Início. */
export async function login(page: Page) {
    const { username, password } = credentials();
    await page.goto(accountPath);
    await expect(page.getByRole("heading", { name: "Bem Vindo à Comunidade Cairbar" })).toBeVisible();
    await page.locator("#username").fill(username);
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
    await expect(page.getByRole("heading", { level: 1, name: /^Olá,/ })).toBeVisible();
}

/** Abre uma página do portal pelo menu (no celular, pelo botão "Abrir menu"). */
export async function navigate(page: Page, label: string) {
    const openMenu = page.getByRole("button", { name: "Abrir menu" });
    if (await openMenu.isVisible()) {
        await openMenu.click();
    }
    await page.getByRole("navigation", { name: "Menu do portal" }).getByRole("link", { name: label }).click();
}

/** Coleta hosts das requisições e mensagens de console para as verificações de privacidade. */
export function watchPage(page: Page) {
    const hosts = new Set<string>();
    const consoleMessages: string[] = [];
    page.on("request", request => {
        const url = new URL(request.url());
        if (url.protocol.startsWith("http")) hosts.add(url.host);
    });
    page.on("console", message => consoleMessages.push(message.text()));
    return { hosts, consoleMessages };
}
