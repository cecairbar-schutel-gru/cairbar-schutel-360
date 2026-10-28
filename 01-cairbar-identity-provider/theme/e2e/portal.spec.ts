import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { accountPath, login, navigate, watchPage } from "./helpers";

const wcag = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("login sem violações de acessibilidade AA", async ({ page }) => {
    await page.goto(accountPath);
    await expect(page.getByRole("heading", { name: "Bem Vindo à Comunidade Cairbar" })).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(wcag).analyze();
    expect(result.violations).toEqual([]);
});

test("login → portal → alterar nome de preferência → aparece no Início", async ({ page }) => {
    await login(page);
    await navigate(page, "Meus dados");

    const field = page.getByLabel("Nome de preferência");
    const original = await field.inputValue();
    const novo = original === "Teste E2E" ? "Teste E2E 2" : "Teste E2E";

    await field.fill(novo);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Dados atualizados.")).toBeVisible();

    await navigate(page, "Início");
    await expect(page.getByRole("heading", { level: 1, name: `Olá, ${novo}!` })).toBeVisible();

    // Restaura o valor original.
    await navigate(page, "Meus dados");
    await page.getByLabel("Nome de preferência").fill(original);
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Dados atualizados.")).toBeVisible();
});

/**
 * Seção 20.3: tentativa de alterar personId. A tela não permite; aqui o POST /account/ do
 * próprio portal é adulterado no caminho (mesmo token e prova DPoP) e o Keycloak deve recusar.
 */
test("Keycloak recusa alteração de personId pela Account API", async ({ page }) => {
    await login(page);
    await navigate(page, "Meus dados");
    const personId = await page.getByLabel("Identificador da pessoa").inputValue();
    expect(personId).toMatch(/^PER-\d{8}$/);

    await page.route(`**${accountPath}`, async route => {
        const request = route.request();
        if (request.method() !== "POST") return route.continue();
        const body = request.postDataJSON();
        body.attributes = { ...body.attributes, personId: ["PER-99999999"] };
        await route.continue({ postData: JSON.stringify(body) });
    });

    const field = page.getByLabel("Nome de preferência");
    await field.fill(`${await field.inputValue()} x`);
    const [response] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith(accountPath) && r.request().method() === "POST"),
        page.getByRole("button", { name: "Salvar" }).click()
    ]);
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("error-user-attribute-read-only");

    await page.unroute(`**${accountPath}`);
    await page.reload();
    await expect(page.getByLabel("Identificador da pessoa")).toHaveValue(personId);
});

test("encerrar sessão de outro dispositivo", async ({ page, browser }) => {
    const other = await browser.newContext({ ignoreHTTPSErrors: process.env.E2E_IGNORE_HTTPS_ERRORS === "true" });
    const otherPage = await other.newPage();
    await login(otherPage);

    await login(page);
    await navigate(page, "Dispositivos e sessões");
    const endButtons = page.getByRole("button", { name: "Encerrar sessão" });
    await expect(endButtons.first()).toBeVisible();

    // Encerra uma a uma as sessões que não são deste dispositivo (inclui a do outro contexto).
    for (let count = await endButtons.count(); count > 0; count--) {
        await endButtons.first().click();
        await page.getByRole("dialog").getByRole("button", { name: "Encerrar" }).click();
        await expect(endButtons).toHaveCount(count - 1);
    }
    await expect(page.getByText("Este dispositivo")).toBeVisible();

    await otherPage.reload();
    await expect(otherPage.getByRole("heading", { name: "Bem Vindo à Comunidade Cairbar" })).toBeVisible();
    await other.close();
});

test("navegação só por teclado: pular para o conteúdo e menu", async ({ page }) => {
    await login(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#conteudo")).toBeFocused();

    if (page.viewportSize()!.width >= 900) {
        const meusDados = page.getByRole("navigation", { name: "Menu do portal" }).getByRole("link", { name: "Meus dados" });
        for (let i = 0; i < 30 && !(await meusDados.evaluate(el => el === document.activeElement)); i++) {
            await page.keyboard.press("Tab");
        }
        await expect(meusDados).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("heading", { level: 1, name: "Meus dados" })).toBeVisible();
    }
});

test("páginas do portal: AA, sem rolagem horizontal, sem domínios externos e sem PII no console", async ({ page, baseURL }) => {
    const { hosts, consoleMessages } = watchPage(page);
    await login(page);

    for (const label of ["Início", "Meus dados", "Minha carteirinha", "Segurança", "Dispositivos e sessões", "Minhas equipes", "Aplicações"]) {
        await navigate(page, label);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        const result = await new AxeBuilder({ page }).withTags(wcag).analyze();
        expect(result.violations, label).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), label).toBe(true);
    }

    expect([...hosts]).toEqual([new URL(baseURL!).host]);

    const personId = await (async () => {
        await navigate(page, "Meus dados");
        return page.getByLabel("Identificador da pessoa").inputValue();
    })();
    for (const message of consoleMessages) {
        expect(message).not.toContain(personId);
        expect(message).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\./); // JWT
    }
});
