# Infraestrutura do Booksys (Ansible)

Playbooks para instalar no Ubuntu 24.04 (`vm-exp-cairbar-360`, 20.55.96.192):

| Playbook | Componente | Porta |
|---|---|---|
| `playbooks/postgresql.yml` | Usuário e banco `booksys` no PostgreSQL compartilhado | 5432 (localhost) |
| `playbooks/tomcat.yml` | Apache Tomcat 11.0.27 + OpenJDK 21, instância própria do SGB (serviço `tomcat-sgb`) | 8081 (localhost) |
| `playbooks/nginx.yml` | Site `https://cairbar-sgb.20-55-96-192.nip.io` no nginx da VM (proxy para o Tomcat) | 80/443 |
| `playbooks/site.yml` | Os três, na ordem correta | |

O PostgreSQL 18, o Keycloak e o nginx não são instalados aqui: os três vêm de
`01-cairbar-identity-provider` (que também faz o backup diário de todos os bancos)
e precisam ser instalados antes. `postgresql.yml` daqui só cria o usuário, o banco e
as regras do `pg_hba.conf` do Booksys (e falha se o PostgreSQL não existir).

Versões, portas e memória ficam em `global_vars/main.yml`.

## nginx (site do SGB)

O nginx, a base compartilhada (`conf.d/cairbar.conf`, snippets `cairbar-*.conf`) e o site
do Keycloak vêm do `playbooks/keycloak.yml` de `01-cairbar-identity-provider` (o
`nginx.yml` falha se a base não existir). Seguindo o mapa de navegação
([`../../esquema-navegacao.png`](../../esquema-navegacao.png)), o `nginx.yml` acrescenta só
o site do Sistema de Biblioteca:

| Hostname | Destino | Arquivo |
|---|---|---|
| `sgb_hostname` (`cairbar-sgb.20-55-96-192.nip.io`) | Tomcat do SGB (`sgb_upstream`, `127.0.0.1:8081`) | `/etc/nginx/sites-available/sgb.conf` |

- HTTP redireciona para HTTPS; o certificado é próprio do site (`sgb_tls_mode`:
  `letsencrypt` pelo webroot compartilhado ou `selfsigned`). O Let's Encrypt limita
  certificados por domínio e o `nip.io` é compartilhado: se a emissão falhar, use `selfsigned`.
- O hostname precisa ser o mesmo de `dominio_sgb` no inventário da solução 01 (redirect
  URIs do cliente `booksys` do realm).
- Log em `/var/log/nginx/sgb-access.log` (JSON com `correlation_id`).

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

## Tomcat do SGB

O DurvalCRM (`02-durval-crm`) tem outro Tomcat na mesma VM. O do SGB é uma instância
separada, com valores próprios em `global_vars/main.yml` que não podem coincidir com os de lá:

| | SGB (aqui) | DurvalCRM |
|---|---|---|
| Serviço systemd | `tomcat-sgb` | `tomcat` |
| Usuário | `tomcat-sgb` | `tomcat` |
| CATALINA_HOME | `/opt/tomcat-sgb` → `/opt/tomcat-sgb-<versão>` | `/opt/tomcat` → `/opt/apache-tomcat-<versão>` |
| CATALINA_BASE | `/var/lib/tomcat-sgb` | `/var/lib/tomcat` |
| Porta HTTP / shutdown | 8081 (só 127.0.0.1) / 8006 | 8080 / 8005 |

O conector HTTP só escuta em loopback: o acesso externo é pelo nginx (`sgb_upstream`).

```bash
sudo systemctl status tomcat-sgb
sudo journalctl -u tomcat-sgb -f
```

## Upgrades

Altere `tomcat_version` (e a URL, se mudar de major) e rode o playbook de novo.
A nova versão é instalada em um diretório próprio e o link simbólico
(`/opt/tomcat-sgb`) passa a apontar para ela. A
instância do Tomcat (conf, webapps, logs) fica em `/var/lib/tomcat-sgb` e não é
afetada.
