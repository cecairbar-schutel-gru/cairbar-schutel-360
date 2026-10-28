---
titulo: Comunidade Cairbar
descricao: A plataforma de identidade digital — uma conta, um perfil e uma carteirinha para cada pessoa da casa.
secao: Soluções
ordem: 10
---

A **Comunidade Cairbar** (pasta `01-cairbar-identity-provider`) é a base de todo o Cairbar 360. Ela responde à pergunta "quem é esta pessoa e o que ela pode fazer?" para todos os outros sistemas.

## O que já existe

### Keycloak e o realm `cecairbar`

- Keycloak 26 instalado de forma nativa (systemd), atrás do nginx com TLS.
- **User Profile** com os atributos da pessoa: `personId`, `fullName`, `identityStatus`, `cardStatus` e opcionais como nome preferido, celular, data de nascimento e vínculos (voluntário, participante).
- **Perfis por grupos**: participantes, operadores, biblioteca, vendedores, PDV, tesouraria e administradores. Quem entra num grupo recebe os perfis dele.
- **Autocadastro** com perfil de participante e **login com Google**.
- Configuração do realm versionada em YAML e aplicada por Ansible pela Admin REST API.

### Tema e portal com Material UI

O tema `cecairbar` foi feito com **Keycloakify 11 + Material UI**, com a identidade visual da casa:

- **Login**: entrar, recuperar e trocar senha, verificar e-mail, completar perfil, configurar e usar autenticação em dois fatores (TOTP), páginas de erro e de sessão expirada.
- **Portal "Comunidade Cairbar"**, onde cada pessoa cuida da própria conta: Início, Meus dados, Minha carteirinha, Segurança, Dispositivos e sessões, Minhas equipes e Aplicações.
- Acessível (contraste WCAG AA, navegação por teclado), responsivo e todo em português.
- Storybook com todas as páginas e testes ponta a ponta com Playwright.

### Geração automática do `personId`

Uma **extensão Java do Keycloak** gera o `personId` (`PER-00000001`, por uma sequência do PostgreSQL) no autocadastro e na criação de usuários pela API, e preenche o status inicial da identidade e da carteirinha. O `personId` é somente leitura para todos, inclusive administradores. Detalhes no ADR 0003.

### Serviço de Carteirinha

Serviço em **Node.js + TypeScript (Fastify)** que emite a carteirinha digital da pessoa:

- QR Code que contém só a referência da pessoa;
- botão **"Salvar no Google Wallet"**;
- acesso ao Google Cloud sem chave de longa duração, por **Workload Identity Federation** com o próprio Keycloak como provedor OIDC (ADR 0002);
- migrações SQL versionadas e testes com Vitest.

## Próximos passos

- Scanner web para operadores lerem a carteirinha.
- Carteirinha no Apple Wallet.
- Integração de referência com a biblioteca (Booksys).
