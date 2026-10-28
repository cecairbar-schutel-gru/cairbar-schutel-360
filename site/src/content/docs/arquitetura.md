---
titulo: Arquitetura
descricao: Como as peças se conectam — identidade, aplicações, banco de dados e infraestrutura.
secao: Começando
ordem: 2
---

## Visão em camadas

```text
                 Navegador / celular
                         │ HTTPS
                         ▼
        ┌──────────── nginx (TLS) ────────────┐
        │                 │                   │
        ▼                 ▼                   ▼
   Keycloak         DurvalCRM            Booksys (SGB)
 (Comunidade       (Tomcat 11 +         (Tomcat 11,
   Cairbar)        Spring Boot)          em breve)
        │                 │                   │
        └───────── PostgreSQL 18 ─────────────┘
          um banco por sistema, backup diário
```

- **nginx** termina o TLS e publica cada sistema no seu próprio endereço. Do Keycloak, só `/realms/` e `/resources/` ficam expostos; o console do realm `master` é bloqueado.
- **Keycloak 26** é o provedor de identidade de todos os sistemas (realm `cecairbar`).
- **PostgreSQL 18** é compartilhado, mas cada sistema tem seu próprio banco e usuário. Um timer do systemd faz o backup diário de todos os bancos.
- **Tomcat 11 + OpenJDK 21** executa os backends Java; cada aplicação tem sua própria instância.

## Regras que valem para todo o ecossistema

1. **O Keycloak é a fonte única de identidade, perfil e autorização.** Nenhum sistema replica o perfil completo da pessoa.
2. **O `personId` (formato `PER-00000001`) é a chave de integração** entre os sistemas: gerado automaticamente, imutável e nunca derivado de CPF, e-mail ou telefone.
3. **O QR Code da carteirinha contém só a referência** `org:person:PER-…` — nunca tokens, perfis, senhas ou dados pessoais.
4. **Ler o QR Code não é autenticação**: o backend sempre valida o token de quem está operando.
5. **Dados transacionais ficam nos sistemas de negócio** — doações, vendas e empréstimos nunca vão para o Keycloak.
6. **Tokens são validados no backend** (emissor, audiência, assinatura e validade), não só na interface.

## Autenticação

- Aplicações web usam **Authorization Code + PKCE (S256)**; integrações entre serviços usam **Client Credentials**. O fluxo de senha direta (ROPC) é proibido.
- Os perfis chegam às aplicações como *realm roles* (`realm_access.roles`) e a claim `person_id` está em todo access token.
- Cada aplicação libera no seu escopo só os perfis que usa (full scope desligado).

## Ambientes

Cada ambiente (`dev`, `qas`, `hml`, `prd`) tem a sua própria máquina virtual, com banco, chaves e segredos próprios. O realm se chama `cecairbar` em todos; o isolamento vem de cada ambiente ter o seu próprio Keycloak.

## Infraestrutura como código

Toda a instalação é feita com **Ansible** (playbooks idempotentes, tarefas em português, sem containers em produção). Cada solução tem sua pasta `ansible/`:

| Pasta | O que instala |
|---|---|
| `01-cairbar-identity-provider/ansible` | PostgreSQL, Keycloak, nginx/TLS, configuração do realm e Serviço de Carteirinha |
| `02-durval-crm/ansible` | Banco `durvalcrm`, Tomcat do DurvalCRM, site no nginx e clients no realm |
| `03-cairbar-booksys/ansible` | Banco `booksys`, Tomcat do SGB e site no nginx |

A identidade é sempre instalada primeiro: as outras soluções dependem do PostgreSQL, do Keycloak e da base do nginx que ela cria.

## Decisões registradas

As decisões de arquitetura ficam em ADRs. Veja o resumo em [Decisões de arquitetura](/docs/decisoes).
