---
titulo: Cairbar Booksys
descricao: A biblioteca comunitária espírita, física e digital.
secao: Soluções
ordem: 12
---

O **Cairbar Booksys** — também chamado de **SGB, Sistema de Gestão de Biblioteca** — (pasta `03-cairbar-booksys`) vai cuidar da biblioteca comunitária da casa.

## Visão do produto

Mais do que controlar empréstimos, a ideia é facilitar o acesso às obras espíritas, fomentar a leitura e fortalecer o senso de comunidade. A experiência conecta cinco momentos:

1. **Descobrir** uma obra relevante.
2. **Acessar** a obra em formato físico ou digital.
3. **Ler** com autonomia e lembretes não punitivos.
4. **Concluir** e avaliar a leitura.
5. **Continuar** a jornada, com novas recomendações, campanhas e reconhecimentos.

## Perfis

| Perfil | Na biblioteca |
|---|---|
| Schutelista | Encomenda livros, faz empréstimos e acompanha sua jornada de leitura |
| Operador | Empresta, recebe devoluções, cadastra listas de espera e monta listas temáticas |
| Bibliotecário | Tudo do operador, mais a gestão do acervo e do inventário |
| Administrador | Acesso completo |

## O que já existe

- Especificação de produto e especificação técnica do MVP (uso interno).
- Playbooks Ansible: banco `booksys`, instância própria do Tomcat 11 e site no nginx.
- Provisionador Java idempotente que cria os clients e escopos da biblioteca no realm `cecairbar`, com testes de integração contra um Keycloak real (Testcontainers).

## Próximos passos

Construção do backend e do frontend do MVP, seguindo a mesma arquitetura e a mesma identidade visual do DurvalCRM.
