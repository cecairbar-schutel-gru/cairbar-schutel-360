---
titulo: Como contribuir
descricao: Como participar do projeto, enviar mudanças por fork e pull request, e atualizar este site.
secao: Comunidade
ordem: 30
---

O Cairbar 360 é feito por voluntários. Toda ajuda conta: código, testes, design, documentação ou simplesmente contar como a rotina da sua casa funciona.

## Formas de ajudar

- **Relatar problemas e sugerir melhorias** pelas *issues* do repositório no GitHub.
- **Testar** as telas no celular e apontar o que é difícil de usar.
- **Escrever documentação** — inclusive nesta página.
- **Desenvolver**: cada solução tem um `README.md` com os comandos para rodar localmente.

## Como enviar sua contribuição

Toda mudança chega ao projeto por um **fork** do repositório [cecairbar-schutel-gru/cairbar-schutel-360](https://github.com/cecairbar-schutel-gru/cairbar-schutel-360) e um **pull request (PR)** para a branch `main`.

### Regras do repositório

| Regra | O que significa |
|---|---|
| Não é possível criar branches no repositório oficial | Trabalhe sempre em uma branch do **seu fork** |
| Ninguém envia commits direto para a `main` | Toda mudança entra por **pull request** |
| Todo PR precisa de **1 aprovação** | Um mantenedor revisa antes do *merge* |
| Novos commits invalidam a aprovação | Se você alterar o PR depois de aprovado, ele é revisado de novo |
| A `main` não aceita *force-push* nem pode ser apagada | O histórico oficial é preservado |

Somente a conta mantenedora do CE Cairbar Schutel (`cecairbar-schutel-gru`) pode enviar diretamente para a `main`.

### Passo a passo

1. **Faça o fork** pelo botão *Fork* no GitHub (ou `gh repo fork cecairbar-schutel-gru/cairbar-schutel-360 --clone`).
2. **Crie uma branch** no seu fork, com um nome que descreva a mudança:

   ```bash
   git switch -c corrige-recibo-pdf
   ```

3. **Faça commits pequenos**, com mensagens em português que digam o que mudou.
4. **Mantenha o fork atualizado** com a `main` oficial antes de abrir o PR:

   ```bash
   git remote add upstream https://github.com/cecairbar-schutel-gru/cairbar-schutel-360.git
   git fetch upstream
   git rebase upstream/main
   ```

5. **Envie a branch para o seu fork** (`git push -u origin corrige-recibo-pdf`) e **abra o PR** para a `main` do repositório oficial (ou `gh pr create --repo cecairbar-schutel-gru/cairbar-schutel-360 --base main`).
6. **Descreva o PR**: o que muda, por que, e como testar. Prints de tela ajudam em mudanças de interface.
7. **Acompanhe a revisão**: responda aos comentários e envie os ajustes na mesma branch — o PR se atualiza sozinho.

Depois do *merge*, a branch do seu fork pode ser apagada.

## Convenções do projeto

- Idioma: **português do Brasil** na interface, no domínio, na documentação e nas mensagens de commit.
- Interface com **Material UI** e o tema da casa (veja [Identidade visual](/docs/identidade-visual)).
- Acessibilidade e celular primeiro.
- Nunca versione senhas, chaves ou endereços de servidores.

## Atualizando este site

O site fica na pasta `site/` e é publicado automaticamente no GitHub Pages sempre que um PR que altere essa pasta é aceito na `main`. As mudanças no site seguem o mesmo fluxo de fork e pull request descrito acima.

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
