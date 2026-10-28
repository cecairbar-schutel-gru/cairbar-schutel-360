# ADR 0003 — personId gerado por extensão do Keycloak, com autocadastro e perfil participante

- **Status:** aceito
- **Data:** 2026-10-23
- **Especificação:** seções 7.3 (User Profile), 8.4/8.5 (roles e grupos), 20 (testes),
  23.2 (quem terá login) e 24 (regras 1, 2 e 6)

## Contexto

A Comunidade Cairbar passa a ter autocadastro. A pessoa que se cadastra precisa sair do
cadastro com perfil de participante (empréstimo no SGB, doações e agendamento de atividades
no DurvalCRM) e com `personId`, porque a claim `person_id` deve estar em todo access token.

Até aqui o `personId` era digitado por um administrador (`required` e `edit: admin` no User
Profile). Isso não funciona no autocadastro e não garante unicidade nem imutabilidade: dois
administradores podem digitar o mesmo valor, e qualquer um pode alterá-lo depois.

## Decisão

- Um módulo Maven `keycloak-extensions/`, instalado em `providers/` pelo `keycloak.yml`, com:
  - o event listener `cecairbar-provisionamento`, habilitado só no realm `cecairbar`. Ele roda
    no autocadastro (`REGISTER`) e na criação pela Admin API (evento administrativo `CREATE` de
    `users/{id}`), na mesma transação da requisição, e preenche o que falta: `personId`,
    `identityStatus=ACTIVE`, `cardStatus=NOT_ISSUED` e `fullName` (nome + sobrenome). No
    autocadastro, também `relationships=[PARTICIPANT]`;
  - a sequência PostgreSQL `cecairbar_person_id_seq`, criada por um changelog Liquibase
    versionado (`JpaEntityProvider`) a partir do maior `personId` existente. O valor nunca vem
    de PII. Se um número já estiver em uso, o listener pula para o próximo.
- `personId` fica **somente leitura para todos** no User Profile (`edit: []`), inclusive para
  administradores e a Admin API: a extensão grava direto no modelo e ninguém altera depois.
- O acesso vem de grupos (`realm/cecairbar-apps.yml`): `/participantes` é o grupo padrão do
  realm, e os perfis operador, vendedor, tesoureiro e administrador são grupos atribuídos por
  um administrador. `relationships` fica só informativo (`VOLUNTEER`, `PARTICIPANT`).

## Alternativas consideradas

- **Provisionamento fora do Keycloak** (serviço que reage ao cadastro): a pessoa ficaria sem
  `personId` entre o cadastro e o processamento, e seria mais um serviço para operar.
- **FormAction no fluxo de registro**: cobre só o autocadastro e exige manter uma cópia do
  fluxo `registration`. A criação por administrador continuaria sem geração.

## Consequências

- O build passa a exigir `mvn package` em `keycloak-extensions/` (Java 21 + Maven, os mesmos do
  tema), e o JAR acompanha a versão do Keycloak (`keycloak.version` no `pom.xml`).
- Usuários criados antes da extensão sem `personId` não podem mais recebê-lo pela API.
  **TODO:** backfill pela própria extensão.
- Se o listener falhar, o Keycloak só registra o erro e o usuário fica sem `personId`.
  **TODO:** alerta/monitoramento desse log.
- **TODO:** `verifyEmail` depois do SMTP. Até lá o e-mail do autocadastro não é confirmado.
- **TODO:** teste de integração contra um Keycloak real (cadastro → token com `person_id`;
  PUT alterando `personId` recusado).
