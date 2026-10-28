# Keycloak da biblioteca

Automação do Keycloak (26.8.1, mesma versão do `ansible/`) para autenticação e autorização conforme as histórias de [devplan/01-identidade-e-leitores](../devplan/01-identidade-e-leitores/README.md).

A biblioteca usa o realm compartilhado **`cecairbar`**, o mesmo do DurvalCRM. O realm, os perfis (realm roles), os grupos que os atribuem, o SMTP, os eventos e os administradores pertencem ao projeto de identidade ([`01-cairbar-identity-provider`](../../01-cairbar-identity-provider/ansible/realm/cecairbar.yml), playbook `keycloak-realm.yml`). Este provisionador só cria o que é da biblioteca.

| Módulo | O que é |
|---|---|
| [provisioner/](provisioner/) | CLI Java idempotente que cria ou atualiza os clients, o client scope e o escopo dos perfis pela Admin REST API. Pode rodar a cada deploy. |
| [integration-tests/](integration-tests/) | Testes contra um Keycloak real em container (Testcontainers). |

A pasta `extensions/` (provider `booksys-reader-role`, que concedia `READER` após a validação do e-mail) saiu do build: no realm compartilhado o perfil padrão vem do grupo `/participantes`. Pode ser apagada.

## Perfis (realm roles de `cecairbar`)

| Perfil | Realm role | Grupo (projeto de identidade) | Na biblioteca |
|---|---|---|---|
| Schutelista | `schutelista` | `/participantes` (grupo padrão: autocadastro e cadastro pelo operador) | Encomenda livros, faz empréstimos e acompanha seu status de leitor na gamificação |
| Operador | `operador` | `/voluntarios/operadores` | Emite empréstimos, recebe devoluções, cadastra listas de espera e monta listas temáticas |
| Bibliotecário | `bibliotecario` | `/voluntarios/biblioteca` | Funções do Operador + gestão completa do acervo e do inventário |
| Administrador | `administrador` | `/administradores` | Acesso completo |

As roles não são compostas: `operador` e `administrador` também valem no DurvalCRM, então "Bibliotecário inclui Operador" e "Administrador inclui todos" são regras da aplicação. As demais realm roles (`vendedor`, `tesoureiro`) não entram no token da biblioteca.

## O que é provisionado

O provisionador falha antes de alterar qualquer coisa se o realm ou alguma das quatro realm roles não existir (rode antes o `keycloak-realm.yml` do projeto de identidade).

| | `booksys-web` (SPA React) | `booksys-api` (Spring Boot) |
|---|---|---|
| Tipo | Público | Confidencial (`client-secret`) |
| Fluxos | Authorization Code + PKCE `S256` | Somente `client_credentials` (service account) |
| Escopo | `fullScopeAllowed=false`; recebe os perfis pelo client scope `booksys-api-access` | — |
| URLs | `BOOKSYS_WEB_URLS` + `/*` (redirect e pós-logout); origens para CORS | — |

O client scope **`booksys-api-access`** (padrão do `booksys-web`) adiciona `booksys-api` ao `aud` e libera só as quatro realm roles da biblioteca no token.

A service account do `booksys-api` recebe `manage-users`, `view-users`, `query-users`, `query-groups` e `view-clients` de `realm-management`: criar leitores (IDE-01/03), sincronizar nome/e-mail (IDE-04), desativar contas (IDE-11/12) e atribuir perfis incluindo a pessoa no grupo do perfil (IDE-12).

## Uso local

Requer Java 21, Maven e Docker ou Podman.

```bash
cd keycloak
mvn package                                   # testes unitários + jar do provisionador
podman compose up -d                          # ou: docker compose up -d
```

O Keycloak local não tem o realm `cecairbar`. Crie-o com as quatro roles (ou rode o projeto de identidade contra ele):

```bash
KCADM="podman compose exec keycloak /opt/keycloak/bin/kcadm.sh"
$KCADM config credentials --server http://localhost:8080 --realm master --user admin --password admin
$KCADM create realms -s realm=cecairbar -s enabled=true
for role in schutelista operador bibliotecario administrador; do $KCADM create roles -r cecairbar -s name=$role; done
```

Depois:

```bash
cp .env.example .env
set -a && . ./.env && set +a
java -jar provisioner/target/booksys-keycloak-provisioner-0.1.0-SNAPSHOT-all.jar
```

- Console: http://localhost:8180/admin (`admin`/`admin`)
- E-mails enviados: http://localhost:8025
- Issuer: `http://localhost:8180/realms/cecairbar`

## Testes

```bash
mvn test                          # unitários (leitura de configuração)
mvn verify -DskipITs=false        # + integração com Keycloak em container
```

Com Podman no macOS, exporte antes:

```bash
export DOCKER_HOST="unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}')"
export TESTCONTAINERS_RYUK_DISABLED=true
```

Os testes de integração cobrem idempotência (sem criar roles), falha sem realm ou sem perfis, configuração dos clients e token da SPA com `aud=booksys-api` levando só os perfis da biblioteca.

## Implantação no servidor

1. Rodar o `keycloak-realm.yml` do projeto de identidade (realm, roles e grupos).
2. Rodar o provisionador com as variáveis do `.env.example`, usando segredos do vault. Prefira um client de serviço no realm `master` (`KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET`) ao usuário `admin`.

## Contrato para o backend e a SPA

- **Issuer**: `https://<keycloak>/realms/cecairbar`.
- **Backend** (resource server): validar assinatura, `iss` e `aud` contendo `booksys-api`. Os perfis vêm de `realm_access.roles` (só `schutelista`, `operador`, `bibliotecario` e `administrador`) e alimentam o `CurrentUserContext` no `KeycloakTokenClaimsAdapter`. O id do leitor é o `sub` (`keycloakUserId`); a chave de integração entre sistemas é a claim `person_id`.
- **SPA**: `keycloak-js` (ou outra lib OIDC) com `clientId=booksys-web`, `pkceMethod: 'S256'`. Para o menu por perfil, use `hasRealmRole('operador')`. O logout deve ser iniciado pelo RP (`end_session_endpoint` com `post_logout_redirect_uri`).
- **Admin API** (backend): `client_credentials` com `booksys-api` e `BOOKSYS_API_CLIENT_SECRET`.

## Regras que ficam na aplicação, não no Keycloak

- **Herança de perfis** (US-IDE-02): Bibliotecário inclui as capacidades do Operador; Administrador, todas.
- **E-mail validado** (RN-01, US-IDE-01): enquanto o realm não exigir a validação (TODO do projeto de identidade), a aplicação só trata o Schutelista como ativo com `email_verified=true`.
- **Último administrador** (US-IDE-12): bloquear a retirada do último administrador ativo do grupo `/administradores` é regra do use case.
- **Termos e privacidade** (US-IDE-08): aceite versionado no `ConsentRecord` da aplicação. A ação obrigatória de termos do Keycloak não é usada.
- **Cadastro incompleto** (US-IDE-10) e **e-mail pendente no balcão** (US-IDE-03): a aplicação consulta o próprio cadastro e a claim `email_verified`.
- **Troca de e-mail** (US-IDE-04): a aplicação grava o novo e-mail com `emailVerified=false` e a ação `VERIFY_EMAIL`. O aviso ao e-mail antigo sai do módulo de comunicação.
- **Exclusão** (US-IDE-11): a aplicação anonimiza os dados e desativa o usuário pela Admin API.
- Telefone e data de nascimento ficam só na aplicação. O Keycloak guarda e-mail, nome e sobrenome.

## Pendências

- **`manage-users`** é amplo e vale para todo o realm compartilhado. Quando a operação estabilizar, avaliar as permissões refinadas (FGAP v2) do Keycloak 26.
- O projeto de identidade também cria o client confidencial `booksys` (por hostname, com as client roles `booksys.reader`, `booksys.operator` e `booksys.manager`; substituiu o antigo `sgb`). Decidir se a aplicação usa ele ou `booksys-web`/`booksys-api` e remover o que sobrar.
- Login social e tempo de sessão para o balcão seguem em aberto (US-IDE-02).
