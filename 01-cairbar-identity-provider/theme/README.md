# Tema Keycloak `cecairbar` (login + Comunidade Cairbar)

Projeto [Keycloakify 11](https://docs.keycloakify.dev) que gera o tema do realm `cecairbar`, com
**Material UI 9.5** e a identidade visual do CE Cairbar Schutel Guarulhos. Decisão e riscos no ADR
[`docs/adr/0001-tema-keycloakify-mui.md`](../docs/adr/0001-tema-keycloakify-mui.md).

| Pasta | Conteúdo |
|---|---|
| `src/shared/` | `theme.ts` (tokens de cor/tipografia), `brand/` (logo e símbolo), `i18n/pt-BR.ts` (rótulos e enums), componentes (`StatusChip`, `PageHeader`, `BrandLogo`, `EmptyState`, `ConfirmDialog`) |
| `src/login/` | `Template.tsx` + páginas em MUI (`pages/`); as demais páginas do Keycloak usam o `DefaultPage` do Keycloakify com o CSS de `fallback.css` |
| `src/account/portal/` | Comunidade Cairbar (SPA): layout, rotas e páginas, sobre a Account REST API |
| `src/account/` (resto), `src/shared/keycloak-ui-shared/` | Código do `@keycloakify/keycloak-account-ui` copiado pelo `postinstall` — **não editar**; para alterar um arquivo, `npx keycloakify own --path <arquivo>` (hoje só `account/KcAccountUi.tsx`) |
| `e2e/` | Testes Playwright contra um Keycloak com o tema instalado |

Versões fixadas: React 18.3.1 (exigido pelo account-ui), `@mui/material` / `@mui/icons-material` 9.5.0,
`@keycloakify/keycloak-account-ui` 260700.x. Fonte Fira Sans auto-hospedada (`@fontsource`), sem CDN.

## Páginas

**Login:** `login`, `login-reset-password`, `login-update-password`, `login-verify-email`,
`login-update-profile` / `update-email`, `login-config-totp`, `login-otp`, `info`, `error`,
`login-page-expired`, `logout-confirm`.

**Portal** (`/realms/cecairbar/account/`): Início, Meus dados, Minha carteirinha, Segurança,
Dispositivos e sessões, Minhas equipes, Aplicações. Contas vinculadas, organizações e recursos UMA
ficam de fora (sem caso de uso). Nada transacional aparece aqui (regra 5).

## Desenvolvimento

Requer Node ≥ 20 (e Java 21 + Maven para gerar o JAR).

```bash
npm ci
npm run storybook        # http://localhost:6006 — todas as páginas com dados fictícios
npm run typecheck
npm run lint             # inclui eslint-plugin-jsx-a11y
npm run build-keycloak-theme   # gera dist_keycloak/cecairbar-theme.jar
```

No Storybook, o login usa o `kcContext` simulado do Keycloakify e o portal usa um `AccountApi`
simulado (`src/account/portal/mocks.ts`) injetado por contexto — sem chamadas de rede.

## Implantar

A partir de `../ansible/` (detalhes no README de lá):

```bash
ansible-navigator run playbooks/keycloak.yml --ee false   # copia para /opt/keycloak/providers e roda kc.sh build
ansible-navigator run playbooks/keycloak-realm.yml        # loginTheme/accountTheme: cecairbar, pt-BR
```

## Testes ponta a ponta

Rodam contra a VM (dev) com o tema já implantado e um usuário de teste com `personId`:

```bash
npx playwright install chromium   # uma vez
E2E_BASE_URL=https://comunidade-cairbar.eastus.cloudapp.azure.com \
E2E_USERNAME=<usuário de teste> E2E_PASSWORD=<senha> npm run test:e2e
```

Cobrem, em desktop e em 375px: login → portal → alterar nome de preferência; recusa do Keycloak a
um `POST /account/` com `personId` adulterado (seção 20.3); encerrar sessão de outro dispositivo;
navegação por teclado; `@axe-core/playwright` sem violações WCAG AA; sem rolagem horizontal; nenhuma
requisição para outro domínio; nenhum `personId` ou JWT no console.

## Segurança e privacidade

- O portal nunca edita `personId` nem atributos de administração; a garantia é do User Profile
  (`edit: [admin]`) e é testada em `e2e/`.
- Tokens só em memória (oidc-spa do account-ui, PKCE); nada de perfil ou token em `localStorage`
  ou no console.
- Sem scripts, fontes ou imagens de terceiros. O QR Code não é gerado no navegador: virá do Serviço
  de Carteirinha (**TODO**, seção 11.1).
- Mensagens neutras no reset de senha e no bloqueio por força bruta (textos em `src/login/i18n.ts`,
  também usados pelo servidor).

## Compatibilidade de versão

Não há build do account-ui para o Keycloak 26.8; o 260700 (26.7) foi comparado com o upstream 26.8.1:
as mudanças na Account REST API são aditivas (novo `DELETE /account/applications/{clientId}/sessions`,
mensagens de evento, bloqueio do endpoint legado de vínculo de contas). Ao atualizar o Keycloak, repetir
essa comparação e atualizar `@keycloakify/keycloak-account-ui` quando houver build da nova versão.

## TODOs

- Logotipo vetorial, paleta oficial e variante para fundo escuro (seção 23.15) — sem ela, não há modo escuro.
- Foto na carteirinha (23.6) — não exibida.
- Toda pessoa terá login? (23.2) — pode mudar os textos de primeiro acesso.
- Contrato do Serviço de Carteirinha (QR e Wallet), SMTP e tema de e-mail, domínio público.
