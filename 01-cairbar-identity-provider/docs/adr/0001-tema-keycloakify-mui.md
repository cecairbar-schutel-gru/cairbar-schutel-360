# ADR 0001 — Tema do Keycloak com Keycloakify e Material UI (Comunidade Cairbar)

- **Status:** aceito
- **Data:** 2026-10-20
- **Especificação:** seções 4.1, 6.1, 21 (fase 5), 22 (Épico A — "configurar temas"), RNF-009 e RNF-010

## Contexto

A pessoa cadastrada precisa gerenciar a própria identidade — do login até
`/realms/cecairbar/account/` — numa experiência com a identidade visual do CE Cairbar Schutel
Guarulhos, acessível (WCAG AA, RNF-009) e responsiva (RNF-010). Os temas padrão do Keycloak 26
(PatternFly) não têm a marca nem o vocabulário da organização ("Comunidade Cairbar",
carteirinha, equipes).

Restrições: o Keycloak é o System of Record (regra 1), não há outro backend para o portal hoje, e
tokens devem continuar curtos e só em memória. A equipe quer Material UI como biblioteca de
componentes.

## Decisão

Gerar um **tema Keycloak (`cecairbar`) com Keycloakify 11**, contendo:

- **login** — `Template` e as páginas mais usadas reescritos com MUI; as demais páginas usam o
  `DefaultPage` do Keycloakify, sem PatternFly, estilizadas por `fallback.css` com as variáveis
  CSS do tema MUI.
- **account** no modo *single-page* — o `@keycloakify/keycloak-account-ui` fornece a
  inicialização (oidc-spa, Authorization Code + PKCE com o cliente `account-console`, tokens em
  memória) e os métodos da Account REST API; a interface PatternFly foi trocada por um portal MUI
  próprio (`src/account/portal/`), assumindo só `account/KcAccountUi.tsx` (`keycloakify own`).

O resultado é um JAR copiado para `/opt/keycloak/providers` pelo Ansible (`keycloak.yml`), seguido
de `kc.sh build`; o realm ativa `loginTheme`/`accountTheme` (`keycloak-realm.yml`).

Versões fixadas: MUI 9.5.0, React 18.3.1 (exigência do account-ui), account-ui 260700.x.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Só CSS/FreeMarker sobre os temas padrão | Personalização limitada do PatternFly 5; impossível usar MUI; páginas novas (carteirinha) exigiriam FTL manual |
| SPA externa (domínio próprio) consumindo a Account REST API | Mais um app para hospedar, registrar como cliente, configurar CORS e manter; o login continuaria precisando de tema |
| Account-ui padrão só com ajuste de cores | Mantém PatternFly e as telas genéricas (recursos UMA, contas vinculadas) que não fazem sentido aqui |

## Consequências

- Login e portal compartilham tema, componentes e textos pt-BR (`src/shared/`); o realm fica só em pt-BR.
- O portal só usa a Account REST API: nada é replicado fora do Keycloak (regra 1) e nada
  transacional aparece nele (regra 5). Integrações futuras (carteirinha, empréstimos) entram como
  cartões que chamam as APIs dos sistemas de negócio por `personId`.
- A tela nunca edita `personId`, mas a garantia é do User Profile (`edit: [admin]`); um teste e2e
  adultera o `POST /account/` e exige a recusa do Keycloak (seção 20.3).
- Gerar o JAR exige Node, Java 21 e Maven na máquina de build, e o `keycloak.yml` passa a rodar
  com `--ee false` (o JAR fica fora do diretório montado no container do EE).
- O código copiado do account-ui (`src/account/`, `src/shared/keycloak-ui-shared/`) é regenerado
  pelo `postinstall`; só o que foi assumido com `keycloakify own` pode ser editado.

## Riscos

- **Versão do account-ui:** não há build 2608xx; o 260700 (Keycloak 26.7) roda sobre o 26.8.1. A
  comparação da Account REST API entre as versões mostrou só mudanças aditivas, mas isso precisa
  ser repetido a cada atualização.
- **Mudanças nas páginas FTL do Keycloak** podem exigir ajustes nas páginas de login reescritas
  (nomes de campos, novas mensagens).
- **Marca provisória:** logo rasterizado (AVIF convertido) e paleta derivada dele; sem variante
  para fundo escuro, o modo escuro fica fora do MVP (TODO seção 23.15).

## Política de atualização

1. Atualizar `keycloak_version` só junto com o tema: conferir o changelog da Account REST API e das
   páginas de login, atualizar `keycloakify` e `@keycloakify/keycloak-account-ui` (quando houver
   build da versão nova) e gerar o JAR de novo.
2. Rodar `npm run typecheck`, `npm run lint`, o Storybook e os testes `e2e/` contra a dev antes de
   hml/prd.
3. Atualizações de MUI/React seguem as dependências de pares do account-ui (hoje React ^18.3).
