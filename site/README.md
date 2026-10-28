# Site do Cairbar 360

Homepage e documentação do projeto, publicadas no GitHub Pages pelo workflow
[`../.github/workflows/pages.yml`](../.github/workflows/pages.yml) a cada push na `main` que altere `site/`.

Vite + React + **Material UI 9.5** com o tema da Comunidade Cairbar (`src/theme.ts`, Fira Sans).

| Pasta | Conteúdo |
|---|---|
| `src/content/docs/` | Páginas da documentação (Markdown com cabeçalho `titulo`, `descricao`, `secao`, `ordem`) |
| `src/content/novidades/` | Uma entrada de Novidades por arquivo `AAAA-MM-DD-assunto.md` (`titulo`, `data`, `projetos`) |
| `src/assets/` | Logotipos do CE Cairbar Schutel e do DurvalCRM |

```bash
npm ci
npm run dev       # http://localhost:5180
npm run build     # typecheck + dist/
```

Ative uma vez no GitHub: **Settings → Pages → Source: GitHub Actions**.
