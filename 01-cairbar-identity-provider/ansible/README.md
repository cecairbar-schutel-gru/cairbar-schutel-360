# Infraestrutura da plataforma de identidade digital (Ansible)

Instalação **monolítica e nativa** (pacotes + tarball oficial + systemd, **sem containers**)
em uma VM Ubuntu 22.04+. O inventário (`inventory/inventory.ini`) é a fonte de verdade
dos hosts; hoje tudo roda em `vm-exp-cairbar-360` (20.55.96.192), junto com 02-durval-crm e 03-cairbar-booksys.

```text
Internet ──443/80──> nginx (TLS, correlation ID, só /realms/ e /resources/)
                       └──> Keycloak 127.0.0.1:8180   (management 127.0.0.1:9000)
                              └──> PostgreSQL localhost:5432 (banco keycloak)
```

| Playbook | O que faz |
|---|---|
| `playbooks/postgresql.yml` | PostgreSQL 18 (PGDG) compartilhado com 02-durval-crm e 03-cairbar-booksys, bancos `keycloak` e `carteirinha`, backup diário de todos os bancos (timer systemd) |
| `playbooks/keycloak.yml` | OpenJDK 21, Keycloak 26.8.1 (`kc.sh build` + `start --optimized`), tema `cecairbar`, nginx + TLS |
| `playbooks/keycloak-realm.yml` | Realm `cecairbar`: configurações, User Profile, roles, grupos, claim `person_id`, login com Google, cliente do Workload Identity Federation |
| `playbooks/site.yml` | Os três, na ordem correta |

Variáveis em `global_vars/main.yml`; definição do realm em `realm/cecairbar.yml`;
segredos em `global_vars/secrets-<ambiente>.yml` (modelo em `secrets.yml.example`).

## Ambientes

Cada ambiente (`dev`, `qas`, `hml`, `prd`) é uma VM própria, com banco, chaves e
segredos próprios (seção 7.1 da especificação). O ambiente vem da variável `ambiente` de
cada host no inventário (`vm-exp-cairbar-360` = `dev`, `cairbar-360-qas` = `qas`), que também
escolhe o arquivo de segredos `global_vars/secrets-<ambiente>.yml`. Use `--limit` para rodar
em um só ambiente. O realm se chama `cecairbar` em todos os ambientes — o
isolamento vem de cada ambiente ter seu próprio Keycloak/banco (o issuer muda pelo hostname).

## Preparação (uma vez)

Execute a partir da pasta `ansible/`:

```bash
# Collections usadas pelos playbooks (montadas no execution environment)
ansible-galaxy collection install -r requirements.yml -p collections

# Segredos: crie a partir do modelo (arquivo fora do git, sem criptografia)
cp global_vars/secrets.yml.example global_vars/secrets-dev.yml   # edite as senhas
cp global_vars/secrets.yml.example global_vars/secrets-qas.yml
chmod 600 global_vars/secrets-*.yml

# O ansible-navigator usa o podman para rodar o execution environment
podman machine start
```

Segredos exigidos: `secret_postgresql_keycloak_password`, `secret_keycloak_admin_password`,
`secret_keycloak_automation_client_secret` (cliente de serviço da automação do realm) e
`secret_keycloak_google_client_id`/`secret_keycloak_google_client_secret` (login com Google).
Os do Serviço de Carteirinha e do Workload Identity Federation estão descritos em
`secrets.yml.example`.

## Execução

No macOS, o ansible-navigator precisa rodar sem `SSH_AUTH_SOCK`: o ansible-runner monta o
socket do ssh-agent no container, mas ele não existe dentro da VM do podman e o container não
sobe (a autenticação usa o arquivo `.pem`). Não há opção de configuração para desligar esse
mount; adicione ao `~/.zshrc`:

```bash
ansible-navigator() { env -u SSH_AUTH_SOCK ansible-navigator "$@"; }
```

`keycloak.yml` (e portanto `site.yml`) copia o JAR do tema de `../theme/dist_keycloak/`, que fica
fora do diretório montado no container do EE: rode esses dois com `--ee false` (ver
[Tema](#tema-login-e-comunidade-cairbar)).

```bash
ansible-navigator run playbooks/site.yml --ee false

# Apenas um componente
ansible-navigator run playbooks/postgresql.yml
ansible-navigator run playbooks/keycloak.yml --ee false

# Checagem de sintaxe
ansible-playbook playbooks/site.yml --syntax-check
```

Os artefatos de cada execução ficam em `artifacts/` e podem ser reabertos com
`ansible-navigator replay artifacts/<arquivo>.json -m interactive`.

## TLS e hostname

- `keycloak_public_hostname` é o nome público: a variável `dominio_publico` do host no
  inventário (dev: `comunidade-cairbar.20-55-96-192.nip.io`) ou, sem ela, o IP da VM
  (`ansible_host`). Ele define o `server_name` do nginx, o certificado, o `hostname` do
  Keycloak (issuer) e o issuer esperado pela carteirinha — mude sempre por aqui.
- Quando é um DNS, o acesso pelo IP da VM (ou por qualquer outro `Host`), em HTTP ou
  HTTPS, recebe 301 para `https://<keycloak_public_hostname>`.
- `keycloak_tls_mode: selfsigned` gera um certificado autoassinado na VM —
  adequado só para dev/testes.
- `keycloak_tls_mode: letsencrypt` emite o certificado com certbot (webroot). Exige
  `keycloak_public_hostname` como DNS apontando para a VM, `keycloak_letsencrypt_email`
  e as portas 80/443 liberadas no NSG. A renovação é automática (timer do certbot).
- `*.nip.io` resolve para o IP embutido no nome (`20-55-96-192` → 20.55.96.192), sem
  configurar DNS. O Let's Encrypt limita certificados por domínio registrado e o `nip.io` é
  compartilhado por muita gente: se a emissão falhar por limite, use `keycloak_tls_mode: selfsigned`.

O nginx publica `/realms/` e `/resources/`; `/metrics` e `/health` não são expostos.
A console de administração (`/admin/` e o realm `master`) fica no hostname próprio
`dominio_admin` do inventário (dev: `https://keycloak.20-55-96-192.nip.io/`, que leva a
`/admin/master/console/`), com certificado próprio; no domínio público o realm `master`
responde 403 e `/admin/` 404. O `keycloak.yml` define o `frontendUrl` do realm `master` com esse
hostname (login da console e issuer dos tokens de administração). Sem `dominio_admin`, a
console volta para `https://<keycloak_public_hostname>/admin/`.
A raiz (`https://<keycloak_public_hostname>/`) redireciona para o portal
(`/realms/cecairbar/account/`).

### nginx incremental e aplicações web (DurvalCRM, SGB)

O nginx é instalado **só por esta solução**; as demais acrescentam o próprio site, seguindo
o mapa de navegação em [`../../esquema-navegacao.png`](../../esquema-navegacao.png):

| Hostname (dev) | Destino | Configurado por |
|----------------|---------|-----------------|
| `comunidade-cairbar.20-55-96-192.nip.io` | Keycloak, realm `cecairbar` (a raiz leva ao cliente `account`) | esta solução (`sites-available/keycloak.conf`) |
| `keycloak.20-55-96-192.nip.io` | Console de administração do Keycloak (`/admin/`, realm `master`) | esta solução (`sites-available/keycloak.conf`) |
| `durvalcrm.20-55-96-192.nip.io` | DurvalCRM | `02-durval-crm` (`sites-available/durvalcrm.conf`) |
| `cairbar-sgb.20-55-96-192.nip.io` | Sistema de Biblioteca (SGB) | `03-cairbar-booksys` (`sites-available/sgb.conf`) |

Esta solução instala também a base que os outros sites usam (e que eles exigem antes de
rodar): `conf.d/cairbar.conf` (correlation ID e log JSON `cairbar_json`) e os snippets
`snippets/cairbar-tls.conf`, `cairbar-proxy.conf` e `cairbar-acme.conf` (webroot do
certbot em `nginx_acme_webroot`). Cada site tem o próprio certificado.

Os hostnames dos apps (`dominio_durvalcrm`, `dominio_sgb` no inventário) servem aqui só para
criar os clientes do realm (`keycloak_apps`) e precisam ser os mesmos das soluções 02 e 03:

- O login é sempre no realm pelo hostname do Keycloak (issuer único
  `https://<keycloak_public_hostname>/realms/cecairbar`): os apps são clientes confidenciais
  (Authorization Code + PKCE S256, segredo `secret_keycloak_<app>_client_secret`) com
  redirect e logout só em `https://<hostname-do-app>/*`. Configure no app o issuer, o
  `client_id` e o mesmo segredo. Para rotacionar o segredo, use `-e realm_apps_atualizar_segredo=true`.
- Os perfis de acesso (participante, operador, vendedor, tesoureiro, administrador) são grupos
  com as client roles de cada app, em `realm/cecairbar-apps.yml`. `/participantes` é o grupo
  padrão: todo usuário novo entra nele, inclusive pelo autocadastro. O app lê as roles em
  `resource_access.<clientId>.roles` e deve validá-las no backend (regra 6).

### Autocadastro e personId

O realm aceita autocadastro. A extensão `../keycloak-extensions` (ADR 0003) gera o `personId`
de todo usuário novo e é instalada pelo `keycloak.yml`, que exige o JAR gerado antes:

```bash
(cd ../keycloak-extensions && mvn package)
ansible-navigator run playbooks/keycloak.yml --ee false
```

`personId` é somente leitura para todos, inclusive administradores. O `keycloak-realm.yml`
troca os relacionamentos antigos (`LIBRARY_MEMBER`, `DONOR`, `EVENT_PARTICIPANT`, `CUSTOMER`)
por `PARTICIPANT` e coloca essas pessoas em `/participantes`. Quem tiver o perfil incompleto
(sem nome ou sobrenome, por exemplo) aparece num aviso, só com o id interno.

A console de administração (`/admin/` e `/realms/master`) é publicada conforme
`keycloak_admin_console_publicada` (ver abaixo).

## Administração

Com `keycloak_admin_console_publicada: true` (padrão), a console fica em
`https://<keycloak_public_hostname>/admin/`, liberada só para as origens de
`keycloak_admin_console_allow` (padrão `all`; as demais recebem 403).
**TODO:** restringir às redes dos administradores em hml/prd.

Com `keycloak_admin_console_publicada: false`, a console fica acessível só por túnel SSH:

```bash
ssh -i inventory/ssh_keys/vm-exp-cairbar-360-key.pem -L 8180:localhost:8180 azureuser@<ip-da-vm>
# http://localhost:8180/admin  (usuário admin / secret_keycloak_admin_password)
```

Na primeira inicialização o Keycloak cria dois acessos **temporários** no realm master:
o usuário `admin` (console) e o cliente de serviço `automacao-ansible` (Client Credentials,
usado por `keycloak-realm.yml`). Se a instalação já estava inicializada, `keycloak.yml`
cria o cliente com `kc.sh bootstrap-admin service`.
**TODO:** substituir ambos por administrador e service account definitivos, com MFA para
administradores (seção 15.1).

## Configuração do realm

`realm/cecairbar.yml` é a configuração versionada (seções 7 e 8). O playbook
`keycloak-realm.yml` usa a Admin REST API: cria o que falta e atualiza configurações do
realm, User Profile e descrição das roles quando diferem. **Não remove** nada — itens
retirados do arquivo devem ser excluídos manualmente. No User Profile, atributos e grupos que
não estão no arquivo (como `caixas`, de 02-durval-crm) são preservados. O mapper do client scope
`person_id` só é criado (não é reconciliado).

Unicidade e geração do `personId` são responsabilidade do provisionamento, não do
Keycloak: o User Profile só valida o formato `PER-00000000` e impede edição pelo usuário.

### Login com Google

O realm tem o identity provider `google` como opção adicional ao usuário e senha. O Google
**não cria contas** nem altera o perfil: o fluxo `primeiro-login-vincular-conta` exige que já
exista no realm um usuário com o mesmo e-mail e pede a senha dele uma vez para vincular as
contas. Sem cadastro, a pessoa vê uma mensagem para procurar a secretaria.

Para cada ambiente (dev/qas/hml/prd), no Google Cloud Console:

1. Configure a tela de consentimento OAuth (escopos `openid` e `email`).
2. Crie um ID do cliente OAuth do tipo **Aplicativo da Web** com o URI de redirecionamento
   `https://<keycloak_public_hostname>/realms/cecairbar/broker/google/endpoint`
   (o Google não aceita IP como domínio: exige `keycloak_public_hostname` com DNS).
3. Coloque client ID e segredo em `global_vars/secrets-<ambiente>.yml` e rode `keycloak-realm.yml`.

O segredo só é gravado na criação do provedor (a Admin API o devolve mascarado). Para
trocá-lo: `ansible-navigator run playbooks/keycloak-realm.yml -e realm_google_atualizar_segredo=true`.

### Google Cloud: Workload Identity Federation

O Serviço de Carteirinha acessa o Google Wallet **sem chave de conta de serviço**: o realm é o
provedor OIDC de um pool do Workload Identity Federation (ADR 0002). O serviço pede um token
ao cliente `servico-carteirinha-gcp` (Client Credentials, sem roles, `aud` = provedor do pool),
o STS do Google o troca por um token federado e, com ele, o serviço personifica a conta de
serviço do Wallet e assina o JWT do botão "Salvar" pela IAM Credentials API (`signJwt`).

O Google baixa o discovery e o JWKS de `https://<keycloak_public_hostname>/realms/cecairbar`
pela internet: exige DNS e certificado válido (`keycloak_tls_mode: letsencrypt`).

Para cada ambiente (um pool por ambiente; o exemplo é o dev), os comandos
abaixo estão em `scripts/gcp-workload-identity.sh`:

```bash
# Projeto comunidade-cairbar-512319 e conta keycloak-srv-acc por padrão (-p e -c para trocar)
scripts/gcp-workload-identity.sh configurar -H comunidade-cairbar.20-55-96-192.nip.io -a dev
# depois de validar a emissão: scripts/gcp-workload-identity.sh excluir-chaves
```

Equivalente manual:

```bash
PROJETO=comunidade-cairbar-512319
NUMERO=$(gcloud projects describe $PROJETO --format='value(projectNumber)')
CONTA=keycloak-srv-acc@$PROJETO.iam.gserviceaccount.com   # convidada no Pay & Wallet Console

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project=$PROJETO

gcloud iam workload-identity-pools create cecairbar-dev --project=$PROJETO --location=global \
  --display-name="Keycloak cecairbar (dev)"

# Audience padrão (https://iam.googleapis.com/projects/...): é a que o realm põe no token.
gcloud iam workload-identity-pools providers create-oidc keycloak --project=$PROJETO \
  --location=global --workload-identity-pool=cecairbar-dev \
  --issuer-uri="https://<keycloak_public_hostname>/realms/cecairbar" \
  --attribute-mapping="google.subject=assertion.azp" \
  --attribute-condition="assertion.azp == 'servico-carteirinha-gcp'"

# Token Creator cobre a personificação (generateAccessToken) e o signJwt.
gcloud iam service-accounts add-iam-policy-binding $CONTA --project=$PROJETO \
  --role=roles/iam.serviceAccountTokenCreator \
  --member="principal://iam.googleapis.com/projects/$NUMERO/locations/global/workloadIdentityPools/cecairbar-dev/subject/servico-carteirinha-gcp"
```

Em `global_vars/secrets-<ambiente>.yml`: `secret_gcp_wif_provider`
(`projects/<NUMERO>/locations/global/workloadIdentityPools/cecairbar-dev/providers/keycloak`),
`secret_google_wallet_service_account_email` e `secret_keycloak_carteirinha_gcp_client_secret`.
Depois rode `keycloak-realm.yml` e `carteirinha.yml` (que apaga a chave antiga da VM).

Com a emissão funcionando, **exclua as chaves da conta** e impeça novas:

```bash
gcloud iam service-accounts keys list --iam-account=$CONTA --managed-by=user
gcloud iam service-accounts keys delete <KEY_ID> --iam-account=$CONTA
# Opcional (exige permissão na organização): constraints/iam.disableServiceAccountKeyCreation
```

O segredo do cliente só é gravado na criação; para trocá-lo:
`ansible-navigator run playbooks/keycloak-realm.yml -e realm_carteirinha_gcp_atualizar_segredo=true`.

### Google Cloud: imagens do passe

O Google baixa logotipo, logotipo horizontal e faixas do passe (`card-service/assets`, geradas por
`card-service/scripts/gerar-imagens-wallet.py`) de uma URL HTTPS pública com certificado válido.
Com `keycloak_tls_mode: letsencrypt` (padrão) o próprio serviço as publica em
`/api/v1/cards/assets` e nada mais é preciso; o Google guarda as imagens em cache pela URL, então
imagens regeradas podem demorar a aparecer. Sem certificado válido, as imagens ficam num bucket
público do Cloud Storage (exige faturamento ativo no projeto) — só a marca, nenhum dado pessoal,
então o mesmo bucket serve todos os ambientes:

```bash
# Projeto comunidade-cairbar-512319 e bucket <projeto>-wallet-assets por padrão (-p e -b para trocar)
scripts/gcp-wallet-assets.sh
```

O script cria o bucket (acesso uniforme, `allUsers` com `roles/storage.objectViewer`), envia as
imagens para um prefixo com o hash do conteúdo — o Google guarda as imagens em cache pela URL — e
imprime o valor de `carteirinha_google_wallet_assets_base_url`. Depois de regerar as imagens, rode
de novo e atualize a variável. Passes já salvos só recebem as imagens novas quando são regravados.

## Tema (login e Comunidade Cairbar)

O tema `cecairbar` (telas de login e a Comunidade Cairbar em `/realms/cecairbar/account/`)
é um projeto [Keycloakify](https://docs.keycloakify.dev) com MUI em `../theme/` — ver
`../theme/README.md` e o ADR `../docs/adr/0001-tema-keycloakify-mui.md`. Ele é gerado
**antes** do Ansible, na máquina de onde o playbook roda (exige Node ≥ 20, Java 21 e Maven):

```bash
cd ../theme && npm ci && npm run build-keycloak-theme   # gera dist_keycloak/cecairbar-theme.jar
cd ../ansible
ansible-navigator run playbooks/keycloak.yml --ee false        # instala o JAR e roda kc.sh build
ansible-navigator run playbooks/keycloak-realm.yml             # loginTheme/accountTheme: cecairbar
```

- `keycloak.yml` falha cedo se o JAR não existir; ao copiar um JAR diferente, roda
  `kc.sh build` (providers exigem rebuild com `start --optimized`) e reinicia o Keycloak.
- `realm/cecairbar.yml` ativa `loginTheme`/`accountTheme` e fixa o idioma em pt-BR. Rode
  o realm só depois do tema instalado — `site.yml` já segue essa ordem.
- E-mails continuam no tema padrão. **TODO:** tema de e-mail depois do SMTP.

## Observabilidade

- Keycloak: logs JSON no journald (`journalctl -u keycloak -o cat`), access log só com o
  caminho (sem query string) e o correlation ID; eventos de login e administrativos
  habilitados no realm (listener `jboss-logging`).
- nginx: `/var/log/nginx/keycloak-access.log` em JSON com `correlation_id`. O cabeçalho
  `X-Request-ID` do cliente é aceito se bem formado; senão é gerado e devolvido na resposta.
- Health e métricas: `curl http://127.0.0.1:9000/health/ready` e `/metrics` (na VM).

## Backup e restauração

`postgresql-backup.timer` executa diariamente `pg_dump --format=custom` de cada banco do
servidor (inclusive `durvalcrm` e `booksys`, criados pelas soluções 02 e 03) em
`/var/backups/postgresql`, com retenção de `postgresql_backup_retention_days` dias.
**TODO:** cópia para fora da VM e política de retenção definitiva (seção 23.12).

```bash
# Backup sob demanda
sudo systemctl start postgresql-backup.service && ls -l /var/backups/postgresql

# Restauração (Keycloak parado)
sudo systemctl stop keycloak
sudo -u postgres dropdb keycloak
sudo -u postgres createdb -O keycloak -E UTF-8 -T template0 --lc-collate=C.UTF-8 --lc-ctype=C.UTF-8 keycloak
sudo -u postgres pg_restore -d keycloak --no-owner --role=keycloak /var/backups/postgresql/keycloak-<data>.dump
sudo systemctl start keycloak
```

Teste a restauração periodicamente (RNF-012).

## Upgrades

Altere `keycloak_version` e rode `keycloak.yml` de novo. A nova versão é instalada em
`/opt/keycloak-<versão>`, recebe `keycloak.conf`, passa pelo `kc.sh build`, e o link
`/opt/keycloak` passa a apontar para ela. Faça um backup antes: o Keycloak migra o schema
do banco na inicialização.

O account-ui do tema é compilado para uma versão específica do Keycloak (hoje 26.7, rodando
no 26.8.1 — ver o ADR do tema). Ao trocar `keycloak_version`, confira a compatibilidade da
Account REST API, atualize `@keycloakify/keycloak-account-ui` quando houver build da nova
versão e gere o JAR de novo.
