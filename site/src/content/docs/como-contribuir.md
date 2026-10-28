---
titulo: Como contribuir
descricao: Como participar do projeto e como atualizar este site.
secao: Comunidade
ordem: 30
---

O Cairbar 360 é feito por voluntários. Toda ajuda conta: código, testes, design, documentação ou simplesmente contar como a rotina da sua casa funciona.

## Formas de ajudar

- **Relatar problemas e sugerir melhorias** pelas *issues* do repositório no GitHub.
- **Testar** as telas no celular e apontar o que é difícil de usar.
- **Escrever documentação** — inclusive nesta página.
- **Desenvolver**: cada solução tem um `README.md` com os comandos para rodar localmente.

## Convenções do projeto

- Idioma: **português do Brasil** na interface, no domínio, na documentação e nas mensagens de commit.
- Interface com **Material UI** e o tema da casa (veja [Identidade visual](/docs/identidade-visual)).
- Acessibilidade e celular primeiro.
- Nunca versione senhas, chaves ou endereços de servidores.

## Atualizando este site

O site fica na pasta `site/` e é publicado automaticamente no GitHub Pages a cada envio para a branch `main` que altere essa pasta.

### Nova página de documentação

Crie um arquivo em `site/src/content/docs/<nome>.md`:

```markdown
---
titulo: Título da página
descricao: Uma frase que resume a página.
secao: Soluções
ordem: 13
---

Conteúdo em Markdown (tabelas, listas e blocos de código funcionam).
Links internos começam com barra: [DurvalCRM](/docs/durvalcrm).
```

- `secao` agrupa as páginas no índice lateral; `ordem` define a posição (menor primeiro).
- O endereço da página é `#/docs/<nome>`.

### Nova entrada em Novidades

Crie um arquivo em `site/src/content/novidades/AAAA-MM-DD-<assunto>.md`:

```markdown
---
titulo: O que mudou, em poucas palavras
data: 2026-10-28
projetos: DurvalCRM, Comunidade Cairbar
---

- Primeira mudança.
- Segunda mudança.
```

A página Novidades e o resumo da página inicial se atualizam sozinhos.

### Rodando o site localmente

```bash
cd site
npm ci
npm run dev
```

Para conferir o resultado final: `npm run build && npm run preview`.
