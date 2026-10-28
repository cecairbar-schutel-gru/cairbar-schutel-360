---
titulo: Visão geral
descricao: O que é o Cairbar 360, por que ele existe e como as soluções se encaixam.
secao: Começando
ordem: 1
---

O **Cairbar 360** é o conjunto de sistemas que o **Centro Espírita Cairbar Schutel — Guarulhos** está construindo para organizar, num só ecossistema digital, tudo o que a casa faz no dia a dia: quem participa, como recebe e presta contas das doações, como vende livros e mantém a cantina, e como empresta as obras da biblioteca.

Hoje muitas dessas rotinas vivem em papel e planilhas. O Cairbar 360 substitui esses controles por aplicações web responsivas, pensadas para voluntários usarem pelo celular, com segurança, auditoria e respeito à LGPD.

## As soluções

| Solução | Para quê | Situação |
|---|---|---|
| [Comunidade Cairbar](/docs/comunidade-cairbar) | Identidade digital: conta única, perfil, carteirinha e perfis de acesso | Em desenvolvimento |
| [DurvalCRM](/docs/durvalcrm) | Doadores, mensalidades, vendas, estoque, editoras, tesouraria e prestação de contas | Em desenvolvimento |
| [Cairbar Booksys](/docs/booksys) | Biblioteca comunitária: catálogo, empréstimos e jornadas de leitura | Em planejamento |

As três soluções compartilham:

- **a mesma conta** — a pessoa entra uma vez pela Comunidade Cairbar e usa todos os sistemas (single sign-on);
- **os mesmos perfis de acesso** — schutelista, operador, bibliotecário, vendedor, tesoureiro e administrador, atribuídos por grupos;
- **a mesma identidade visual** — cores e tipografia da casa (veja [Identidade visual](/docs/identidade-visual));
- **a mesma infraestrutura** — PostgreSQL, Keycloak e nginx instalados por Ansible (veja [Arquitetura](/docs/arquitetura)).

## Organização do repositório

```text
cairbar-schutel-360/
├── 01-cairbar-identity-provider/   Comunidade Cairbar (Keycloak, tema, carteirinha, extensões)
├── 02-durval-crm/                  DurvalCRM (backend Spring Boot, frontend React, Ansible)
├── 03-cairbar-booksys/             Booksys (Ansible e automação do Keycloak)
├── scripts/                        Utilitários do repositório
└── site/                           Este site (GitHub Pages)
```

## Quem participa

O projeto é feito por voluntários da casa. O código é aberto sob a **Licença Apache 2.0** para que outras casas espíritas e organizações sem fins lucrativos possam reaproveitá-lo. Quer ajudar? Veja [Como contribuir](/docs/como-contribuir).
