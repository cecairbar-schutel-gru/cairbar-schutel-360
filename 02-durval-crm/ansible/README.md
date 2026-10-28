# Infraestrutura do DurvalCRM (Ansible)

Playbooks para instalar no Ubuntu 24.04:

| VM | IP | Componentes |
|---|---|---|
| `vm-exp-cairbar-360` | 203.0.113.10 | dev: Tomcat (+ banco `durvalcrm` no PostgreSQL compartilhado) |
| `cairbar-360-qas` | 203.0.113.20 | qas: Tomcat (+ banco `durvalcrm` no PostgreSQL compartilhado) |

| Playbook | Componente | Porta |
|---|---|---|
| `playbooks/postgresql.yml` | Usuário e banco `durvalcrm` no PostgreSQL compartilhado (só conexões locais) | 5432 |
| `playbooks/tomcat.yml` | Apache Tomcat 11.0.27 + OpenJDK 21 | 8080 |
| `playbooks/nginx.yml` | Site `https://durvalcrm.203-0-113-10.nip.io` no nginx da VM (proxy para o Tomcat) | 80/443 |
| `playbooks/site.yml` | Os três, na ordem correta | |
| `playbooks/keycloak-cecairbar.yml` | Clients e escopo das realm roles do DurvalCRM no realm `cecairbar` (US-AUTH-005) | — |
| `playbooks/durvalcrm-app.yml` | Implanta `../backend/target/ROOT.war` (API + SPA) no Tomcat e espera o `/actuator/health` | — |

O Keycloak não é instalado por estes playbooks: o DurvalCRM usa o realm
`cecairbar` do Keycloak existente em
`https://comunidade-cairbar.203-0-113-10.nip.io`.

O PostgreSQL 18 também não é instalado aqui: ele é instalado, configurado e tem
backup diário pelo `playbooks/postgresql.yml` de `01-cairbar-identity-provider`,
que precisa rodar antes. `postgresql.yml` daqui só cria o usuário, o banco e as
regras do `pg_hba.conf` do DurvalCRM (e falha se o PostgreSQL não existir).

Versões, portas e memória ficam em `global_vars/main.yml`.

## Preparação (uma vez)

Execute a partir da pasta `ansible/`:

```bash
# Collections usadas pelos playbooks (montadas no execution environment)
ansible-galaxy collection install -r requirements.yml -p collections

# Segredos (já criados: global_vars/vault.yml criptografado com .vault_pass)
ansible-vault view global_vars/vault.yml --vault-password-file .vault_pass   # ver senhas
ansible-vault edit global_vars/vault.yml --vault-password-file .vault_pass   # alterar

# O ansible-navigator usa o podman para rodar o execution environment
podman machine start
```

## Execução

No macOS, rode sem `SSH_AUTH_SOCK`: o socket do ssh-agent não existe dentro da
VM do podman e o container não sobe (a autenticação usa o arquivo `.pem`).

```bash
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/site.yml --vault-password-file .vault_pass

# Apenas um componente
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/tomcat.yml --vault-password-file .vault_pass

# Sem container (usa o Ansible local)
ansible-navigator run playbooks/site.yml --ee false --vault-password-file .vault_pass
```

Os artefatos de cada execução ficam em `artifacts/` e podem ser reabertos com
`ansible-navigator replay artifacts/<arquivo>.json -m interactive`.

## Aplicação (WAR)

O `tomcat.yml` grava em `setenv.sh` a configuração do DurvalCRM (`DURVALCRM_DB_*` e
`DURVALCRM_KEYCLOAK_ISSUER`). O `durvalcrm-app.yml` implanta o WAR, que já traz o SPA; gere-o antes
(ver `../backend/README.md`) e rode com `--ee false`, porque `../backend` não é visível no execution
environment. O Tomcat só é reiniciado quando o WAR muda; a primeira partida aplica as migrações do Flyway.

```bash
(cd ../backend && mvn clean verify)
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/durvalcrm-app.yml --ee false --vault-password-file .vault_pass
```

**TODO:** `DURVALCRM_KEYCLOAK_CLIENT_SECRET` (lista de usuários, US-ADMIN-001) ainda não está no vault.

## nginx (site do DurvalCRM)

O nginx **não** é instalado aqui: ele, a base compartilhada (`conf.d/cairbar.conf`, snippets
`cairbar-*.conf`) e o site do Keycloak vêm do `playbooks/keycloak.yml` de
`01-cairbar-identity-provider`, que precisa rodar antes (o `nginx.yml` falha se a base não
existir). Seguindo o mapa de navegação ([`../../esquema-navegacao.png`](../../esquema-navegacao.png)),
o `nginx.yml` acrescenta só o site do DurvalCRM:

| Hostname | Destino | Arquivo |
|---|---|---|
| `durvalcrm_hostname` (`durvalcrm.203-0-113-10.nip.io`) | Tomcat (`durvalcrm_upstream`, `127.0.0.1:8080`) | `/etc/nginx/sites-available/durvalcrm.conf` |

- HTTP redireciona para HTTPS; o certificado é próprio do site (`durvalcrm_tls_mode`:
  `letsencrypt` pelo webroot compartilhado ou `selfsigned`). O Let's Encrypt limita
  certificados por domínio e o `nip.io` é compartilhado: se a emissão falhar, use `selfsigned`.
- O hostname precisa ser o mesmo de `dominio_durvalcrm` no inventário da solução 01 e é a
  base de `durvalcrm_web_urls` (redirect URIs de `durvalcrm-web`).
- Log em `/var/log/nginx/durvalcrm-access.log` (JSON com `correlation_id`).

```bash
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/nginx.yml --vault-password-file .vault_pass
```

## Realm `cecairbar` (DurvalCRM)

O realm `cecairbar` já existe e é compartilhado com outros sistemas. O playbook
`keycloak-cecairbar.yml` cria ou atualiza **apenas** os objetos do DurvalCRM;
nunca cria/remove o realm nem altera outros clients, roles ou configurações
(login, política de senha, brute force e timeouts continuam a cargo do realm).
Por isso ele não faz parte do `site.yml`.

| Objeto | Configuração |
|---|---|
| Client `durvalcrm-web` | Público, só Standard Flow, PKCE `S256`, front-channel logout, full scope desligado; redirect/post-logout URIs e web origins de `durvalcrm_web_urls` |
| Client `durvalcrm-api` | Confidencial, só com conta de serviço (client credentials); audience do token. A conta de serviço tem apenas `view-users`, `view-clients` e `view-events` de `realm-management`, para a lista de usuários só leitura do DurvalCRM (US-ADMIN-001); o segredo vai em `DURVALCRM_KEYCLOAK_CLIENT_SECRET` |
| Realm roles do DurvalCRM | `operador`, `vendedor`, `pdv`, `tesoureiro`, `administrador`: criadas e atribuídas aos grupos pela solução 1 (`01-cairbar-identity-provider`, `keycloak-realm.yml`, que precisa rodar antes); aqui só são escopadas em `durvalcrm-web`, que também recebe o mapper `audiencia-api` (`aud` = `durvalcrm-api`). As antigas client roles de `durvalcrm-api` deixaram de ser usadas e podem ser removidas na console |
| Mapper e atributo `caixas` | Removidos se existirem: o DurvalCRM não usa mais caixas autorizados (desde 26/10/2026, cada forma de pagamento entra na conta de recebimento definida no próprio DurvalCRM) |

O playbook roda no controlador (ou no execution environment), sem acessar VMs
do inventário: cada host de `webapps` é um ambiente, com os domínios das suas variáveis
(use `--limit cairbar-360-qas` para um só), e chama a Admin API em `cecairbar_keycloak_admin_url`. Autentica no
realm `master` com `cecairbar_admin_user` e a senha
`vault_keycloak_admin_password` do vault.

```bash
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/keycloak-cecairbar.yml --ee false --vault-password-file .vault_pass \
  -e ansible_ssh_private_key_file=/dev/null
```

A segunda execução seguida deve terminar com `changed=0`.

### Variáveis por ambiente

Definidas em `global_vars/main.yml`; os domínios vêm das variáveis de cada host no
inventário (`dominio_publico`, `dominio_admin`, `dominio_durvalcrm`, os mesmos da solução 01).
Sobrescreva as demais com `-e`:

| Variável | Padrão | Uso |
|---|---|---|
| `cecairbar_realm` | `cecairbar` | Realm alvo (precisa existir) |
| `cecairbar_keycloak_url` | `https://<dominio_publico>` (dev: `comunidade-cairbar.203-0-113-10.nip.io`, qas: `comunidade-cairbar.203-0-113-20.nip.io`) | URL pública do Keycloak (verificação do realm, endpoints OIDC) |
| `cecairbar_keycloak_admin_url` | `https://<dominio_admin>` (dev: `keycloak.203-0-113-10.nip.io`, qas: `keycloak.203-0-113-20.nip.io`) | Hostname de administração: token do realm `master` e Admin API (o público bloqueia `master`) |
| `cecairbar_admin_user` | `admin` | Usuário do realm `master` com permissão de administração |
| `durvalcrm_web_urls` | `[https://<durvalcrm_hostname>]` | URLs do SPA, sem barra final; cada uma vira `<url>/*` (redirect e post-logout) e `<url>` (web origin) |
| `cecairbar_roles` | 4 roles da Spec §2 e `pdv` | Realm roles liberadas no escopo do SPA |

Exemplo para incluir o SPA local de desenvolvimento:

```bash
env -u SSH_AUTH_SOCK ansible-navigator run playbooks/keycloak-cecairbar.yml --vault-password-file .vault_pass \
  -e '{"durvalcrm_web_urls": ["https://durvalcrm.203-0-113-10.nip.io", "http://localhost:5173"]}'
```

Os papéis vêm dos grupos do realm (solução 1): `/voluntarios/operadores` → `operador`,
`/voluntarios/vendas` → `vendedor`, `/pdv` → `pdv` (só o PDV da cantina), `/tesouraria` → `tesoureiro`, `/administradores` → `administrador`.
Incluir o usuário no grupo continua manual na console: Users → Groups → Join group.

### Smoke test

Com um usuário de teste que tenha alguma role do DurvalCRM, faça login pelo fluxo do SPA (Authorization Code + PKCE; o client não
aceita password grant):

```bash
KC=https://comunidade-cairbar.203-0-113-10.nip.io/realms/cecairbar/protocol/openid-connect
REDIRECT=https://durvalcrm.203-0-113-10.nip.io/callback          # precisa casar com durvalcrm_web_urls
VERIFIER=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-64)
CHALLENGE=$(printf %s "$VERIFIER" | openssl dgst -sha256 -binary | openssl base64 | tr '+/' '-_' | tr -d '=')

# 1. Abra no navegador, faça login e copie o parâmetro "code" da URL de retorno
echo "$KC/auth?client_id=durvalcrm-web&response_type=code&scope=openid&redirect_uri=$REDIRECT&code_challenge=$CHALLENGE&code_challenge_method=S256"

# 2. Troque o code pelo token
CODE=<code copiado>
TOKEN=$(curl -s "$KC/token" -d grant_type=authorization_code -d client_id=durvalcrm-web \
  -d code="$CODE" -d redirect_uri="$REDIRECT" -d code_verifier="$VERIFIER" | jq -r .access_token)

# 3. Decodifique o payload e confira aud e roles
echo "$TOKEN" | cut -d. -f2 | tr '_-' '/+' | base64 -d 2>/dev/null | jq '{aud, roles: .realm_access.roles}'
```

Esperado: `aud` contém `durvalcrm-api` e `roles` lista só as roles do DurvalCRM
do usuário.

## Upgrades

Altere `tomcat_version` (e a URL, se mudar de major) e rode o playbook de novo.
A nova versão é instalada em um diretório próprio e o link simbólico
`/opt/tomcat` passa a apontar para ela. A
instância do Tomcat (conf, webapps, logs) fica em `/var/lib/tomcat` e não é
afetada.
