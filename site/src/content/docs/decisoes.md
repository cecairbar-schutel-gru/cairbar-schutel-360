---
titulo: Decisões de arquitetura
descricao: Resumo dos ADRs (Architecture Decision Records) já aceitos.
secao: Referência
ordem: 21
---

Decisões importantes são registradas como ADRs em `01-cairbar-identity-provider/docs/adr/`. Cada uma descreve o contexto, a decisão e as consequências.

## ADR 0001 — Tema do Keycloak com Keycloakify e Material UI

*Aceito em 20/10/2026.*

Os temas padrão do Keycloak não tinham a marca nem o vocabulário da casa. Decidimos gerar o tema `cecairbar` com **Keycloakify 11**, reescrevendo o login e o portal da conta com **Material UI**, mantendo os tokens curtos e só em memória (Authorization Code + PKCE).

## ADR 0002 — Google Wallet por Workload Identity Federation

*Aceito em 22/10/2026.*

Para emitir a carteirinha no Google Wallet, o serviço precisava de uma chave JSON de conta de serviço — um segredo de longa duração. Agora o próprio realm `cecairbar` é o provedor OIDC de um pool de **Workload Identity Federation** no Google Cloud: o serviço troca o token do Keycloak por credenciais temporárias e as chaves da conta de serviço foram excluídas.

## ADR 0003 — `personId` gerado por extensão do Keycloak

*Aceito em 23/10/2026.*

Com o autocadastro, o `personId` não podia mais ser digitado por um administrador. Uma **extensão Java do Keycloak** gera o identificador por uma sequência do PostgreSQL, preenche os atributos iniciais e dá o perfil de participante a quem se cadastra. O `personId` passou a ser somente leitura para todos.
