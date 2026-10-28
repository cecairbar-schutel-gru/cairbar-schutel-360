# Plano — Tema "Portal do Voluntário" (Keycloak 26.8.1 + Keycloakify + MUI 9.5.0)

## Contexto

A especificação (seções 4.1, 6.1, 21 fase 5 e 22 Épico A — "configurar temas") prevê que a pessoa cadastrada
gerencie a própria identidade. Hoje o realm `cecairbar` usa os temas padrão do Keycloak (PatternFly). O objetivo é
que a jornada do usuário — do login até `https://20.55.92.104/realms/cecairbar/account/` — seja um **Portal do
Voluntário** com a identidade visual do CE Cairbar Schutel Guarulhos, construído com **Material UI 9.5.0**.

Decisões já tomadas com o usuário:
- **Escopo:** tema `login` + tema `account` (e-mails ficam para depois, dependem do SMTP — TODO no realm).
- **Carteirinha:** página com `personId` e `cardStatus` vindos do Keycloak; QR e botões de Wallet são `TODO` até
  existir `/api/v1/cards` (seção 11.1).
- **Abordagem:** Keycloakify 11 (account *single-page*), reescrevendo as telas com MUI e consumindo a
  Account REST API do Keycloak. Resultado: um JAR de tema instalado pelo Ansible.

Fatos verificados:
- Keycloak `26.8.1` (`ansible/global_vars/main.yml`), nginx já publica `/realms/` e `/resources/` (assets do tema).
- `@mui/material@9.5.0` e `@mui/icons-material@9.5.0` existem; peers: React 17–19, `@emotion/react` ^11.5,
  `@emotion/styled` ^11.3.
- `keycloakify@11.16.3`; `@keycloakify/keycloak-account-ui` mais recente é `260700.0.4` (Keycloak 26.7) e exige
  **React ^18.3.1**, `react-router-dom` ^6.30, `react-hook-form`, `i18next`. → fixar React 18.3 (compatível com MUI 9.5).
- Não há build `2608xx` do account-ui: validar a Account REST API do 26.8.1 contra a 260700 (risco, ver Fase 0).
- `ce_cairbar_logo.png` é na verdade **AVIF** (840×252, fundo branco, faixas azul-claro + texto preto).
- User Profile (`ansible/realm/cecairbar.yml`): `personId`, `fullName`, `birthDate`, `identityStatus`,
  `relationships`, `cardStatus` são *view: user / edit: admin*; `preferredName`, `mobilePhone`, `email`,
  `firstName`, `lastName` são editáveis pelo usuário. `registrationAllowed: false`, `resetPasswordAllowed: true`.

## Estrutura proposta

Novo diretório `theme/` na raiz (projeto Keycloakify independente do `ansible/`):

```
theme/
  package.json            # react 18.3, @mui/material 9.5.0, @mui/icons-material 9.5.0, @emotion/*, keycloakify 11.16.x
  vite.config.ts          # plugin keycloakify: themeName "cecairbar", accountThemeImplementation "Single-Page",
                          #   keycloakVersionTargets restrito a 26.x
  src/
    shared/
      theme.ts            # createTheme MUI (tokens de cor/tipografia/forma), modo claro (+ escuro opcional)
      brand/              # logo.png/webp convertidos do AVIF, logo-dark, símbolo (faixas) p/ favicon
      i18n/pt-BR.ts       # rótulos + tradução de enums (ACTIVE→"Ativa", VOLUNTEER→"Voluntário"...)
      components/         # StatusChip, PageHeader, BrandLogo, EmptyState, ConfirmDialog
    login/                # KcPage.tsx + páginas FTL reescritas em MUI
    account/              # account-ui ejetado; layout e rotas reescritos em MUI
    kc.gen.tsx            # gerado pelo keycloakify
  .storybook/             # stories com kcContext mock (login) e Account API mock (MSW)
```

Fontes auto-hospedadas (`@fontsource/*`), sem CDN (privacidade/CSP).

## Identidade visual (a partir do logotipo)

- **Primária:** azul das faixas (~`#85C1E9`) como cor de marca/decorativa; para texto, botões e links usar um tom
  escurecido da mesma matiz (ex.: ~`#1F6FA8`) que passe **WCAG AA 4.5:1** sobre branco (RNF-009). Validar contraste.
- **Neutros:** preto do logotipo para texto (`#111`), fundos brancos/cinza-claro.
- **Status:** `success`/`warning`/`error`/`default` do MUI mapeados para `ACTIVE`/`SUSPENDED`/`REVOKED|INACTIVE`/`NOT_ISSUED`.
- Logo horizontal no AppBar e no card de login; símbolo das faixas como favicon e avatar compacto no mobile.
- `TODO(seção 23.15)`: logotipo vetorial (SVG) e paleta oficial; variante do logo para fundo escuro (texto preto
  some no dark mode — sem ela, dark mode fica fora do MVP).

## Jornada e páginas

### Tema `login` (FTL substituídas por componentes MUI via Keycloakify)

| Página Keycloak | Tela no portal |
|---|---|
| `login.ftl` | "Entrar no Portal do Voluntário": usuário/e-mail + senha, link "Esqueci minha senha" (sem "Cadastre-se": registro desabilitado) |
| `login-reset-password.ftl` | Solicitar redefinição (mensagem neutra, sem revelar se o e-mail existe) |
| `login-update-password.ftl` | Nova senha com dicas da política (`length(12)`, não usar usuário/e-mail, histórico 5) |
| `login-verify-email.ftl` | Instruções de verificação de e-mail |
| `login-update-profile.ftl` / `update-email.ftl` | Completar perfil — campos renderizados pelos metadados do User Profile; `personId` só leitura |
| `login-config-totp.ftl` / `login-otp.ftl` | Configurar/usar 2FA (preparado para MFA de admins, seção 15.1) |
| `info.ftl`, `error.ftl`, `login-page-expired.ftl`, `logout-confirm.ftl` | Mensagens padronizadas (Alert MUI) |

Demais páginas FTL continuam no fallback padrão do Keycloakify (renderização genérica com o tema MUI aplicado).
Mensagem de bloqueio por força bruta deve ser clara e sem detalhes técnicos.

### Tema `account` — Portal do Voluntário (SPA, cliente `account-console`, PKCE já nativo)

Layout: `AppBar` com logo + menu do usuário (nome de preferência, Sair); `Drawer` permanente no desktop e
temporário no mobile (RNF-010); rotas em `react-router-dom` 6.

| Rota | Página | Fonte de dados (Account REST API `/realms/cecairbar/account/...`) |
|---|---|---|
| `/` | **Início**: "Olá, {preferredName}", cards de situação da identidade e da carteirinha, chips de relacionamentos, atalhos | `GET /account/?userProfileMetadata=true` |
| `/meus-dados` | **Meus dados**: formulário gerado a partir de `userProfileMetadata` (respeita `readOnly`/permissões; agrupado por "Identidade"); `personId`, `fullName`, `birthDate`, status e relacionamentos só leitura com texto "para corrigir, procure a secretaria" | `GET`/`POST /account/` |
| `/carteirinha` | **Minha carteirinha**: `personId` legível + `StatusChip(cardStatus)`; área do QR e botões Apple/Google Wallet como `TODO` (serviço inexistente). Sem gerar QR no navegador — o QR oficial é do Serviço de Carteirinha | perfil (Keycloak); `TODO`: `GET /api/v1/cards/{personId}` |
| `/seguranca` | **Segurança**: senha e 2FA (lista de credenciais; ações via `kc_action=UPDATE_PASSWORD` / `CONFIGURE_TOTP`, remoção de OTP) | `GET /account/credentials` |
| `/dispositivos` | **Dispositivos e sessões**: sessões ativas, encerrar uma/todas | `GET`/`DELETE /account/sessions/devices`, `/account/sessions` |
| `/equipes` | **Minhas equipes**: grupos (`/voluntarios/biblioteca`, ...) com nomes amigáveis | `GET /account/groups` |
| `/aplicacoes` | **Aplicações da organização**: apps com acesso/consentimento, link para abrir, revogar consentimento | `GET`/`DELETE /account/applications` |

Fora do portal (não há caso de uso): contas vinculadas (sem IdP externo), organizações, recursos UMA.
Nada transacional (empréstimos, doações, escalas) aparece aqui — futuras integrações com os sistemas de negócio
(fase 5) entram como novos cards consumindo as APIs deles por `personId`, nunca o Keycloak (regra 5).

## Regras de segurança e privacidade no frontend

- Nunca habilitar edição de `personId` no front; mas a garantia é do User Profile (`edit: [admin]`) — incluir teste
  que tenta `POST /account/` alterando `personId` e espera rejeição (critério de aceite, seção 20.3).
- Sem `console.log` de perfil/tokens; sem `localStorage` com PII; tokens só em memória (padrão do account-ui).
- Sem scripts/fontes de terceiros (CSP e LGPD); exibir só os atributos que o usuário pode ver.
- Mensagens de erro genéricas (não revelar existência de contas no reset de senha).

## Integração com a infraestrutura (Ansible)

- `ansible/global_vars/main.yml`: `keycloak_theme_name: cecairbar` e caminho local do JAR
  (`keycloak_theme_jar: "{{ playbook_dir }}/../../theme/dist_keycloak/<jar gerado>.jar"`).
- `ansible/playbooks/keycloak.yml`: tarefa "Instalar tema do portal" copiando o JAR para
  `{{ keycloak_install_dir }}/providers/cecairbar-theme.jar` (`register`); incluir esse registro na condição do
  "Gerar build otimizado do Keycloak" (providers exigem `kc.sh build` com `start --optimized`); `notify: Reiniciar Keycloak`.
- `ansible/realm/cecairbar.yml` (`realm_settings`): `loginTheme: cecairbar`, `accountTheme: cecairbar`,
  `internationalizationEnabled: true`, `supportedLocales: [pt-BR]`, `defaultLocale: pt-BR`. Conferir que
  `playbooks/keycloak-realm.yml` envia `realm_settings` inteiro no PUT (sem lista fixa de chaves).
- Garantir que o tema seja aplicado só após o JAR instalado (`site.yml` já roda `keycloak.yml` antes de `keycloak-realm.yml`).
- `ansible/README.md` e `CLAUDE.md`: como gerar o JAR (`npm ci && npm run build-keycloak-theme`, exige Java + Maven
  na máquina de build) e implantar.
- ADR `docs/adr/0001-tema-keycloakify-mui.md`: por que Keycloakify + MUI no lugar de PatternFly/SPA externa,
  risco de versão do account-ui, política de atualização junto com o Keycloak.

## Fases

0. **Spike (risco):** scaffold Keycloakify (`keycloakify-starter` + `npx keycloakify initialize-account-theme`
   single-page), fixar versões, gerar JAR, instalar na VM dev e abrir `/realms/cecairbar/account/` com o account-ui
   260700 sobre o Keycloak 26.8.1. Se houver incompatibilidade da API: alinhar `keycloak_version` a 26.7.x ou
   aguardar build 2608xx (decisão do usuário).
1. **Fundação visual:** `theme.ts`, conversão do logo (AVIF→PNG/WebP + favicon), componentes compartilhados,
   i18n pt-BR, Storybook.
2. **Tema login:** páginas da tabela acima + stories de cada estado (erro, bloqueio, expirado).
3. **Portal account:** layout, Início, Meus dados, Segurança, Dispositivos, Equipes, Aplicações.
4. **Carteirinha (placeholder)** com `TODO` de integração (audience/CORS do Serviço de Carteirinha a definir).
5. **Infra + documentação:** tarefas Ansible, realm, README/CLAUDE.md, ADR.

## TODOs (seção 23 — não inventar)

- Logo vetorial, paleta oficial e variante para fundo escuro (23.15).
- Foto na carteirinha/portal (23.6) — não exibir foto.
- Toda pessoa terá login? (23.2) — afeta textos de primeiro acesso.
- Contrato e URL do Serviço de Carteirinha; QR e Wallet.
- SMTP (reset de senha e verificação de e-mail só funcionam ponta a ponta com ele) e tema de e-mail.
- Domínio público (hoje IP com certificado autoassinado).

## Verificação

- `npm run build`, `npm run lint` (com `eslint-plugin-jsx-a11y`), `tsc --noEmit` em `theme/`.
- Storybook com cada página de login e do account (mocks MSW da Account API) — revisão visual desktop/mobile.
- Testes Playwright contra a VM dev:
  login → portal → editar `preferredName` → ver na Início; tentar alterar `personId` via `POST /account/`
  (espera 400/ignorado); encerrar sessão em Dispositivos; navegação só por teclado; `@axe-core/playwright` sem
  violações AA; viewport 375px sem rolagem horizontal.
- Ansible: `ansible-playbook playbooks/keycloak.yml --syntax-check`; executar `keycloak.yml` + `keycloak-realm.yml`
  na dev e confirmar JAR em `/opt/keycloak/providers`, `loginTheme/accountTheme = cecairbar`, e reexecução sem
  mudanças (idempotência).
- Conferir no DevTools que nenhuma requisição sai para domínios externos e que não há PII/tokens no console.
