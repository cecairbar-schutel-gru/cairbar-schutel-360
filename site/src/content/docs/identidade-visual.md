---
titulo: Identidade visual
descricao: Cores, tipografia e logotipos compartilhados por todas as soluções.
secao: Referência
ordem: 20
---

Todas as telas do Cairbar 360 — o login e o portal da Comunidade Cairbar, o DurvalCRM e este site — usam o **mesmo tema do Material UI**. As cores foram extraídas do logotipo do CE Cairbar Schutel e ajustadas para atender ao contraste **WCAG AA**.

## Cores

| Token | Cor | Uso |
|---|---|---|
| `primary.main` | `#2C698B` | Botões, links e destaques (6,0:1 sobre branco), sempre com texto branco |
| `primary.dark` / `secondary.main` | `#1B4055` | Títulos de marca, rodapé e realces |
| `primary.light` | `#7DC1E7` | Azul das faixas do logotipo — **só decorativo**, nunca para texto |
| `text.primary` | `#111111` | Texto principal |
| `text.secondary` | `#4A5560` | Texto de apoio |
| `background.default` | `#F4F7FA` | Fundo das páginas |
| `background.paper` | `#FFFFFF` | Cartões e superfícies |
| `success` / `warning` / `error` | `#2E7D32` / `#8A5300` / `#C62828` | Estados (contraste AA também como texto) |

## Tipografia

- Fonte **Fira Sans** (pesos 400, 500 e 700), auto-hospedada com `@fontsource/fira-sans`, sem CDN.
- Títulos em 700 (h1, h2) e 500 (h3 a h6); botões sem caixa alta.

## Forma e componentes

- Cantos arredondados de 10 px (`shape.borderRadius`).
- Botões sem sombra, cartões com contorno, barra superior branca com a **faixa azul** de 4 px no topo.
- Foco sempre visível: contorno de 3 px no azul das faixas.

## Logotipos

| Logotipo | Onde aparece |
|---|---|
| CE Cairbar Schutel Guarulhos (horizontal e símbolo das faixas) | Comunidade Cairbar, cabeçalhos e este site |
| DurvalCRM (avatar circular) | Login e menu do DurvalCRM |

## Onde o tema está definido

- `01-cairbar-identity-provider/theme/src/shared/theme.ts`
- `02-durval-crm/frontend/src/shared/theme/tema.ts` e `paleta.ts`
- `site/src/theme.ts`

> Ao mudar o tema de um lado, mude dos outros: a identidade é uma só.
