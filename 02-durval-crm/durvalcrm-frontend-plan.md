# DurvalCRM — Plano de Desenvolvimento do Frontend

## Visão Geral

**Objetivo:** construir o frontend do **DurvalCRM**, plataforma para organizações sem fins lucrativos gerenciarem doadores recorrentes, mensalidades/doações, vendas (livros e cantina), estoque próprio e consignado, intenções de gasto, fluxo de caixa, conciliação, repasses a editoras e prestação de contas (ver [`descricao-durvalcrm.md`](descricao-durvalcrm.md)).

**Linha de base visual:** wireframe do MVP com 12 telas (Painéis Operador/Vendedor/Tesoureiro/Administrador, Registrar contribuição em 4 passos, Nova venda, Estoque, Intenção de gasto, Prestação de contas). O título "Gestão de Voluntários e Recursos" do wireframe é substituído pela marca **DurvalCRM**.

**Decisões confirmadas com o usuário:**

| Tema | Decisão |
|---|---|
| Localização | pasta `frontend/` na raiz do repositório (o workspace hoje contém apenas `descricao-durvalcrm.md` e `.bob/`; não há código existente a reaproveitar) |
| Stack | Vite + React + TypeScript, Material UI v9.5.0 open source (`@mui/material@9.5.0`, `@mui/icons-material`, Emotion), `@mui/x-charts` (gratuito), React Router |
| Dados | camada de serviços com dados mockados (MSW + JSON local), desacoplada para trocar pelo backend real depois |
| Autenticação | Keycloak **simulado** com seletor de perfil; integração real fica para depois |
| Tema/idioma | tema MUI próprio (`createTheme`), fundo claro, interface em pt-BR (`ptBR` do MUI) |
| Paleta de cores | remete ao logotipo [`ce_cairbar_logo.png`](ce_cairbar_logo.png): mesma identidade da Comunidade Cairbar (`01-cairbar-identity-provider/theme/src/shared/theme.ts`): primária `#2C698B`, faixa `#7DC1E7`, texto `#111111`, fundo `#F4F7FA`, Fira Sans; paleta derivada (primária, neutros, semânticas, gráficos) aplicada via `createTheme()` do MUI (Fase 1.1) |
| Organização | estrutura por feature (`features/doadores`, `features/vendas`, ...) |
| Navegação | menu lateral e rotas controlados pelo(s) perfil(is) ativo(s); seletor de perfil para usuários com papéis acumulados |
| Escopo | mapa de telas expandido completo (seção 6 da descrição); as 12 telas do wireframe primeiro (fases 3 a 8), as demais depois (fases 9 a 13) |
| Testes | Vitest + Testing Library |

**Abordagem:** entregar em fases independentes e revisáveis. Primeiro a fundação (projeto, shell, auth simulada, mocks), depois as telas do wireframe agrupadas por jornada, e por fim as telas adicionais do mapa expandido seguindo os mesmos padrões.

## Mapeamento Wireframe → Fase

| # | Tela do wireframe | Fase |
|---|---|---|
| 1–4 | Painéis Operador, Vendedor, Tesoureiro, Administrador | 3 |
| 5 | Registrar contribuição — Passo 1 Buscar doador | 4 |
| 6 | Passo 2 Competências e pagamento | 4 |
| 7 | Passo 3 Formas de pagamento e confirmação | 4 |
| 8 | Passo 4 Comprovante e agradecimento | 4 |
| 9 | Nova venda | 5 |
| 10 | Estoque — Produtos | 5 |
| 11 | Intenção de gasto e aprovação | 6 |
| 12 | Relatórios — Prestação de contas mensal | 7 |

## Convenções Transversais (valem para todas as fases)

- Uso de componentes MUI (AppBar, Drawer, Table, Card, Dialog, Stepper, Chip, Tooltip etc.) em vez de CSS próprio; ajustes visuais via `sx`/`styled` lendo valores do tema. Nada de componentes pagos (MUI X Pro/Premium).
- Cores sempre via `theme.palette` do tema DurvalCRM (Fase 1.1, derivado do logotipo); proibido usar hex solto em componentes. Texto sobre a cor primária deve ser escuro para cumprir contraste WCAG AA.
- Valores monetários em BRL (`Intl.NumberFormat pt-BR`), datas em `dd/mm/aaaa`, competências em `mês/ano`.
- Regras de negócio da descrição refletidas na UI: sem pagamento parcial de competência; soma dos meios de pagamento deve bater com o total; venda sem estoque bloqueada; preço fixo no momento da venda; cancelamentos preservam o lançamento original.
- Cada serviço de dados expõe uma interface TypeScript; a implementação mock (MSW) é a única que muda ao integrar o backend.
- Acessibilidade: navegação por teclado, rótulos e `aria-*` nos formulários e tabelas; link "Pular para o conteúdo" no shell.
- Cada fase termina com `npm run lint`, `npm run typecheck`, `npm run test` e `npm run build` sem erros.

---

## Fase 1 — Fundação do projeto

**Intent:** criar o esqueleto do frontend com tooling, Material UI e estrutura de pastas por feature.

**Expected Outcomes:**
- `frontend/` roda com `npm run dev`, compila com `npm run build`, executa testes com `npm run test`.
- Material UI v9.5.0 configurado (`ThemeProvider` + `CssBaseline`) com tema inicial; marca DurvalCRM e logotipo visíveis.
- Estrutura de pastas definida e documentada em `frontend/README.md`.

**Todo List:**
1. Scaffold Vite + React + TS em `frontend/`.
2. Instalar `@mui/material@9.5.0`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@mui/x-charts`, `react-router-dom`, `msw`, `vitest`, `@testing-library/react`, `jsdom`, ESLint/Prettier.
3. Configurar `ThemeProvider`, `CssBaseline` e localização `ptBR` do MUI no provider raiz.
4. Definir estrutura: `src/app` (rotas, providers), `src/shared` (componentes, formatadores, tipos), `src/features/<dominio>`, `src/services`, `src/mocks`, `src/auth`.
5. Configurar scripts `lint`, `typecheck`, `test`, `build` e setup de testes.
6. Escrever `frontend/README.md` com comandos e convenções.

**Relevant Context:** [`descricao-durvalcrm.md`](descricao-durvalcrm.md) (seções 1 e 6); decisões na tabela acima.

**Status:** `[ ] pending`

---


## Fase 1.1 — Tema MUI e paleta do logotipo (cor principal #7DC1E8)

**Intent:** definir a identidade visual do DurvalCRM a partir do logotipo [`ce_cairbar_logo.png`](ce_cairbar_logo.png) (ícone azul claro `#7DC1E8` e nome em grafite `#161616`, sobre fundo claro) e aplicá-la ao tema do Material UI, para que todas as telas das fases seguintes herdem a mesma paleta sem cores soltas no código.

> **Revisão (26/10/2026):** a paleta abaixo foi substituída pela identidade visual da Comunidade Cairbar (`01-cairbar-identity-provider/theme/src/shared/theme.ts`): primária `#2C698B` com texto branco, faixa `#7DC1E7` só decorativa, Fira Sans, raio 10 e shell no padrão do portal. Ver §2.3 de [durvalcrm-stack-tecnologica.md](durvalcrm-stack-tecnologica.md).

**Expected Outcomes:**
- Paleta documentada a partir do logotipo: primária (`main` `#7DC1E8`, `light`, `dark` e `contrastText` `#161616`), texto (`text.primary` `#161616`), fundos claros (`background.default`, `background.paper`) e cores semânticas (`success`, `warning`, `error`, `info`) que continuem legíveis ao lado da primária.
- Tema único criado com `createTheme()` em `frontend/src/shared/theme/`, aplicado via `ThemeProvider` + `CssBaseline`, incluindo `palette`, tipografia, `shape` e overrides de componentes (`components.MuiButton`, `MuiDrawer`, `MuiListItemButton` etc.) quando necessário.
- Regras de contraste registradas: `#7DC1E8` é uma cor clara (contraste com branco ≈ 2:1, abaixo do mínimo WCAG AA), portanto texto sobre ela deve ser escuro (`#161616`, contraste ≈ 9:1); texto, links e ícones sobre fundo claro devem usar `primary.dark` ou tons mais escuros que atinjam AA (4,5:1 para texto, 3:1 para componentes de UI). Botões primários e item ativo do menu lateral seguem essa regra.
- Cores dos gráficos (`@mui/x-charts`, versão gratuita) definidas a partir da paleta (Receitas na primária, Despesas em um neutro/complementar distinguível, sem depender só de cor).
- Página interna de referência (rota de desenvolvimento, ex.: `/dev/paleta`) exibindo swatches, valores do tema e exemplos de componentes MUI (Button, Chip, Card, item ativo do Drawer, Alert, Table) com a paleta aplicada.

**Todo List:**
1. Extrair as cores do logotipo e derivar os tons `light`/`dark` da primária, os neutros e as cores semânticas; registrar nomes e valores em `frontend/src/shared/theme/` e no `README`.
2. Verificar contraste de cada par texto/fundo previsto (texto sobre primária, primária escura sobre fundo claro, estados hover/selecionado/foco/desabilitado) e ajustar tons até cumprir WCAG AA.
3. Criar o tema com `createTheme()` e aplicá-lo com `ThemeProvider` + `CssBaseline` no provider raiz da Fase 1.
4. Definir a paleta de gráficos e a configuração compartilhada para `@mui/x-charts`.
5. Criar a página de referência da paleta (apenas em desenvolvimento) e um teste de renderização simples.
6. Validar visualmente o shell e os componentes principais com a paleta aplicada.

**Relevant Context:** logotipo [`ce_cairbar_logo.png`](ce_cairbar_logo.png); §2.3 de [`durvalcrm-stack-tecnologica.md`](durvalcrm-stack-tecnologica.md); wireframe (usa azul claro como acento nos itens ativos de menu, botões primários e barras de gráfico); convenção de "sem hex solto, usar o tema" nas Convenções Transversais.

**Status:** `[ ] pending`

---



## Fase 2 — Autenticação simulada, permissões e camada de dados mock

**Intent:** habilitar perfis e dados falsos para que todas as telas possam ser desenvolvidas sem backend.

**Expected Outcomes:**
- Tela de login simulada com escolha de usuário/perfis (Operador, Vendedor, Tesoureiro, Administrador; um usuário pode acumular papéis).
- Seletor de perfil ativo no cabeçalho para usuários com múltiplos papéis.
- Contexto de auth expondo usuário, papéis e perfil ativo (os papéis vêm do Keycloak; desde 26/10/2026 não há caixas autorizados).
- Rotas protegidas por papel; redirecionamento para o painel do perfil ativo.
- MSW ativo em desenvolvimento com dados seed (doadores, competências, produtos, estoque, contas, contas de recebimento, lançamentos, editoras, plano de contas inicial da seção 5).

**Todo List:**
1. Criar `AuthProvider` com interface `AuthService` (implementação simulada, trocável por Keycloak).
2. Definir tipos de domínio compartilhados (Doador, Competência, Contribuição, Produto, MovimentoEstoque, Venda, ContaFinanceira, Lançamento, IntençãoDeGasto, Editora, Remessa).
3. Criar helper `RequireRole` e mapa papel → rotas/itens de menu.
4. Montar handlers MSW e fixtures seed; interface de serviço por domínio em `src/services`.
5. Implementar seletor de perfil e telas de login/sair.
6. Testes: guarda de rotas por papel e troca de perfil.

**Relevant Context:** descrição seção 2 (perfis) e nota do Keycloak; seção 5 (plano de contas) para o seed.

**Status:** `[ ] pending`

---

## Fase 3 — Shell da aplicação e Painéis (wireframes 1–4)

**Intent:** implementar o layout comum (cabeçalho, menu lateral por perfil) e os quatro painéis iniciais.

**Expected Outcomes:**
- Shell com cabeçalho (marca DurvalCRM, rótulo do perfil, nome do usuário), menu lateral e "Sair", fiel ao wireframe.
- Menu por perfil conforme wireframe:
  - Operador: Painel, Doadores, Vendas, Financeiro, Estoque, Relatórios (divergência: no sistema o Operador vê só o Painel e o grupo Operação — Doadores, Receber contribuição, Recibos e Aniversariantes)
  - Vendedor: Painel, Vendas, Estoque, Financeiro, Relatórios
  - Tesoureiro: Painel, Financeiro, Conciliação, Editoras, Relatórios
  - Administrador: Painel, Cadastros, Financeiro, Estoque, Editoras, Relatórios, Configurações
- **Painel Operador (1):** saudação, atalhos (Registrar contribuição, Cadastrar doador, Nova venda, Consultar estoque, Solicitar gasto, Aniversariantes do mês) e lista de aniversariantes.
- **Painel Vendedor (2):** atalhos (Nova venda, Consultar estoque, Registrar entrada, Entrada por doação, Solicitar baixa, Histórico de vendas) e tabela de produtos com baixo estoque.
- **Painel Tesoureiro (3):** visão financeira do mês (KPIs: previsto, recebido, pendente, saldo, receita líquida, taxas de cartão), atalhos (Aprovar gastos, Conciliar conta, Liquidar cartão, Pagar editoras) com contadores, lista de pendências do período.
- **Painel Administrador (4):** KPIs (doadores ativos, vendas no mês, resultado no mês), atalhos (Gerenciar usuários, Plano de contas, Configurar mensagens, Fechamento mensal) e gráfico de barras Receitas vs Despesas (últimos 6 meses) com `@mui/x-charts`.

**Todo List:**
1. Construir `AppShell` com MUI (`AppBar`/`Toolbar`, `Drawer` com logotipo, link "Pular para o conteúdo", área principal).
2. Configurar React Router com rotas por feature e layout aninhado.
3. Criar componentes compartilhados: `ShortcutTile`, `KpiTile`, `PendingList`, `PageHeader`.
4. Implementar os 4 painéis consumindo serviços mock.
5. Implementar o gráfico Receitas vs Despesas.
6. Testes de renderização por perfil e navegação do menu.

**Relevant Context:** wireframe telas 1–4; MUI `AppBar`, `Drawer`, `Card`, `CardActionArea`; `@mui/x-charts` `BarChart`.

**Status:** `[x] done` — shell, menu por perfil e painéis do Operador (Fase 4), do Vendedor (Fase 5), do Tesoureiro (wireframe 3, `features/financeiro/pages/PainelTesoureiroPage.tsx`) e do Administrador (wireframe 4, US-ADMIN-021, `features/administracao/pages/PainelAdministradorPage.tsx`: doadores ativos, vendas e resultado do mês com variação, atalhos do wireframe mais remessa, título, editoras, mensalidade e relatórios, gráfico Receitas vs Despesas dos últimos 6 meses com `@mui/x-charts`, aprovações de estoque em abas com destaque das que travam o fechamento, período atual e último fechado com "Reabrir", mensalidade agendada e avisos de geração de competências, gastos pendentes).

---

## Fase 4 — Registrar contribuição em 4 passos (wireframes 5–8) — Jornada A

**Intent:** entregar o fluxo central do Operador: receber mensalidade/doação do início ao comprovante.

**Expected Outcomes:**
- Fluxo em `ProgressIndicator` com 4 passos (Buscar doador → Selecionar competências → Pagamento → Comprovante), estado compartilhado entre passos e botões Voltar/Continuar.
- **Passo 1 (5):** busca por nome, telefone ou e-mail; resultados com botão Selecionar; ação "Cadastrar novo doador" (cadastro rápido em modal).
- **Passo 2 (6):** cabeçalho do doador com mensalidade e "Ver histórico"; checkboxes de competências (pendentes e futuras); resumo (competências, doação extraordinária, total); campo para excedente/doação extraordinária.
- **Passo 3 (7):** divisão em Dinheiro físico, PIX (conta bancária) e Cartão de crédito/débito; resumo; validação da soma contra o total, com aviso da diferença como doação extraordinária; cada forma mostra a conta de recebimento definida pelo Administrador (sem escolha de caixa ou conta).
- **Passo 4 (8):** notificação de sucesso, competências quitadas, comprovante digital (visualização PDF), envio por WhatsApp/e-mail com mensagem pré-preenchida (link `wa.me` / `mailto:`), botões "Nova contribuição" e "Voltar ao painel".

**Todo List:**
1. Criar feature `features/contribuicoes` com rota `/contribuicoes/nova` e store do fluxo.
2. Implementar busca de doador com debounce e cadastro rápido.
3. Implementar seleção explícita de competências e cálculo do resumo (sem pagamento parcial).
4. Implementar formulário de pagamento misto com validação de soma e classificação de excedente.
5. Implementar tela de comprovante (HTML imprimível/PDF mock) e geração de mensagens a partir de modelos.
6. Testes: validação de soma, bloqueio de avanço sem seleção, geração de links de mensagem.

**Relevant Context:** wireframe telas 5–8; descrição seção 3 (Jornada A) e seção 4 (Mensalidades, Doações).

**Status:** `[x] done` — histórias US-CONTRIB-002 a 012 e 021 (`features/contribuicoes`). Divergência: o cadastro rápido do passo 1 usa a tela já existente da Fase 9 (`/doadores/novo`) em vez de um modal. O componente de divisão de pagamento está em `features/contribuicoes/components/EtapaPagamento.tsx`, pronto para ser extraído para `shared` na Fase 5.

---

## Fase 5 — Vendas e Estoque (wireframes 9–10) — Jornada B

**Intent:** entregar a venda de livros e cantina e a consulta de estoque.

**Expected Outcomes:**
- **Nova venda (9):** tabela editável de itens (Produto, Tipo, Preço, Qtd, Subtotal, remover), "Adicionar produto", total, forma de pagamento (incluindo misto) com a conta de recebimento de cada forma, Cancelar / Finalizar venda. Bloqueio quando a quantidade excede o saldo; preço fixo vigente exibido.
- **Estoque (10):** abas "Produtos da cantina" e "Livros consignados", busca, botão "Registrar entrada", tabela (Produto, Saldo, Última entrada, Status, Ações) com paginação.

**Todo List:**
1. Criar features `vendas` e `estoque` com rotas e serviços mock (decremento de saldo na venda).
2. Implementar a grade de itens e validação de estoque.
3. Implementar pagamento misto reutilizando o componente de divisão da Fase 4 (extrair para `shared`).
4. Implementar listagem de estoque com abas, busca e paginação MUI (`Tabs`, `TablePagination`).
5. Testes: bloqueio sem saldo, cálculo de total, atualização de saldo mock.

**Relevant Context:** wireframe telas 9–10; descrição seção 3 (Jornada B) e seção 4 (Estoque, Livros consignados, Preços).

**Status:** `[x] done` — Vendas entregue (US-SALES-001 a 021, `features/vendas`): nova venda (wireframe 9) com busca única, botões da cantina por categoria, carrinho guardado no navegador, pagamento misto com troco e atalho "Tudo em…", comprovante, lista/detalhe, cancelamento, refazer e painel do Vendedor (wireframe 2). A divisão de pagamento foi extraída para `shared/pagamento`. Estoque (wireframe 10, `features/estoque`, US-INVENTORY-009): abas "Produtos da cantina" e "Livros consignados", busca (nome, autor ou ISBN), filtros de categoria, situação e "Somente sem saldo", "Registrar entrada", tabela com preço, saldo (com "aguardando baixa"; nos livros, próprio e consignado), última entrada, status e menu de ações, com paginação. Os mocks de produtos e lotes passaram a viver em `mocks/bancoEstoque.ts`, compartilhados com as vendas.

---

## Fase 6 — Intenção de gasto e aprovação (wireframe 11) — Jornada C

**Intent:** permitir ao Operador solicitar gastos e preparar a estrutura de aprovação.

**Expected Outcomes:**
- Formulário "Nova intenção de gasto": descrição, categoria, subcategoria (dependente da categoria, plano de contas com um nível), valor estimado, justificativa, anexo opcional, Cancelar / Enviar para aprovação.
- Listagem das intenções do usuário com status.

**Todo List:**
1. Criar feature `financeiro/intencoes` com rota e serviço mock.
2. Implementar selects dependentes categoria → subcategoria a partir do plano de contas seed.
3. Implementar upload opcional de anexo (mock).
4. Testes de validação e dependência categoria/subcategoria.

**Relevant Context:** wireframe tela 11; descrição seção 3 (Jornada C) e seção 5.

**Status:** `[x] done` — histórias US-EXPENSE-001 a 009 (`features/intencoes`, rotas `/intencoes-gasto/...`; divergência: feature própria em vez de `financeiro/intencoes`). Nova intenção (wireframe 11) com categoria → subcategoria (sem Repasse às editoras e Taxas de cartão), valor estimado, justificativa, até 5 anexos (PDF/JPG/PNG de até 10 MB) e, na Compra de produtos da cantina, lista de produtos e quantidades; "Minhas intenções" com filtro por situação e destaque do que mudou desde a última visita; retirada do pedido pendente e "Copiar como nova" da rejeitada; fila "Aprovar gastos" da Tesouraria (pendentes das mais antigas, divergentes e todas) com detalhe, anexos abertos no navegador e gasto do mês na subcategoria; aprovação com ajuste do valor total/categoria (nota obrigatória), meio (dinheiro → caixa; PIX, transferência ou boleto → banco), conta e data, gerando a despesa; rejeição com motivo; "Receber compras" do Vendedor com conferência das quantidades (divergência bloqueia a entrada no estoque); correção (quantidades acordadas e novo valor, com estorno e novo lançamento) ou cancelamento (estorno) da compra divergente. Contadores nos painéis do Tesoureiro (atalho "Aprovar gastos" e pendências), do Administrador, do Operador (minhas intenções em andamento) e do Vendedor (compras aguardando recebimento). Mocks em `mocks/bancoIntencoes.ts`, ligados ao razão e ao estoque simulados.

---

## Fase 7 — Relatório de prestação de contas mensal (wireframe 12)

**Intent:** entregar o relatório consolidado do mês para o Administrador.

**Expected Outcomes:**
- Seletor de mês, botão Exportar (Excel/PDF mock), KPIs (saldo inicial, receitas, despesas, saldo final) e duas tabelas "Receitas por categoria" / "Despesas por categoria" com barras de percentual, nota de rodapé sobre valores agregados.

**Todo List:**
1. Criar feature `relatorios` com rota `/relatorios/prestacao-de-contas`.
2. Implementar agregação por categoria no serviço mock.
3. Implementar componente de barra de percentual por linha e exportação simulada.
4. Testes de totais e formatação.

**Relevant Context:** wireframe tela 12; descrição seção 6 (Relatórios).

**Status:** `[x] done` — a prestação de contas mensal é o demonstrativo consolidado do fechamento (`/fechamento/:mes/demonstrativo`, US-CLOSING-007, Fase 11), agora com "Exportar" (Excel e PDF gerados pelo servidor, US-REPORT-021) e aberta também pelo índice "Relatórios". O layout do wireframe 12 (seletor de mês, "Exportar ▾", indicadores e as tabelas de receitas e despesas por categoria com barra de participação e nota de rodapé) é o padrão de todos os relatórios da Fase 13 (`features/relatorios`). Divergência: rota `/relatorios/receitas-despesas` (US-REPORT-002) em vez de `/relatorios/prestacao-de-contas`; a exportação é real (servidor) e não simulada.

---

## Fase 8 — Revisão de fidelidade ao wireframe

**Intent:** garantir que as 12 telas-base estejam consistentes entre si antes de expandir.

**Expected Outcomes:**
- Telas 1–12 comparadas com o wireframe; divergências corrigidas ou documentadas no `README`.
- Componentes repetidos extraídos para `shared`.
- Auditoria de acessibilidade e de aderência ao tema MUI aplicada nas telas entregues.

**Todo List:**
1. Revisar cada tela contra o wireframe e ajustar espaçamentos/rótulos.
2. Auditar acessibilidade (ex.: `axe`) e uso do tema (sem hex solto, componentes MUI) nos arquivos principais e corrigir apontamentos.
3. Consolidar padrões (formulário, tabela com filtros, modais de confirmação) em guia curto no README.

**Relevant Context:** todo o `frontend/src`.

**Status:** `[ ] pending`

---

## Fase 9 — Doadores (telas adicionais)

**Intent:** completar o módulo Doadores da seção 6.

**Expected Outcomes:** listagem/busca, cadastro rápido e completo, histórico de competências, aniversariantes (lista completa), inativação, reativação e anonimização (somente Administrador, com confirmação e justificativa).

**Todo List:**
1. Criar listagem com busca e filtros por status.
2. Criar formulário de cadastro completo e detalhe do doador com histórico de competências.
3. Criar tela de aniversariantes com filtro por mês.
4. Criar ações de inativar (decisão sobre pendências), reativar e anonimizar com modal de confirmação.
5. Testes de permissões das ações e fluxos de confirmação.

**Relevant Context:** descrição seção 4 (Mensalidades — inativação/reativação), seção 6 (Doadores).

**Status:** `[ ] pending`

---

## Fase 10 — Vendas e estoque (telas adicionais)

**Intent:** completar catálogo, movimentações e aprovações de estoque.

**Expected Outcomes:** catálogo de produtos (cadastro, alteração e inativação de preço com fluxo de solicitação/aprovação), entrada de compra (com bloqueio em caso de divergência), entrada por doação, solicitação de baixa (vencimento/dano/extravio) e aprovação administrativa, histórico de movimentações, cancelar/refazer venda.

**Todo List:**
1. Criar telas de catálogo e formulário de produto.
2. Criar fluxo de solicitação → aprovação para alteração de preço e inativação.
3. Criar entrada de compra aprovada e entrada por doação.
4. Criar solicitação e fila de aprovação de baixa.
5. Criar histórico de movimentações com filtros.
6. Criar cancelamento de venda preservando lançamento original.
7. Testes das regras de aprovação e bloqueios.

**Relevant Context:** descrição seção 2 (Vendedor, Administrador), seção 4 (Estoque, Preços), seção 6.

**Status:** `[~] parcial` — Estoque entregue (US-INVENTORY-001 a 016): cadastro de títulos (Administrador) e de produtos da cantina com aviso de nome parecido; página do produto com saldo por origem, histórico de preços e histórico de movimentos (filtros por período e tipo, saldo após cada movimento); entrada por doação com cancelamento pelo Administrador; pedidos de baixa (lote FIFO pré-selecionado, foto opcional), de novo preço e de inativação da cantina; fila "Aprovações de estoque" do Administrador e "Minhas solicitações" (também no painel do Vendedor); preço direto de livro, inativação/reativação e ajuste após contagem. Cancelar/refazer venda já vinham da Fase 5. A entrada de compra aprovada (com bloqueio por divergência) veio com o módulo Intenções de gasto (US-EXPENSE-006, Fase 6). Em 27/10/2026 (US-SALES-022, Fase 1 do [plano de melhorias](enhancements/plano-melhorias-2026-10-27.md)): PDV da cantina com carrinho fixo (rodapé em retrato, lateral em paisagem), cobrança só pelo botão "Cobrar" com confirmação explícita, troco em dinheiro, nome do usuário no cabeçalho, "Última venda" com cancelamento pelo próprio PDV, cancelamento das vendas do PDV pelo Tesoureiro e tag/filtro "PDV" na lista de vendas. Em 27/10/2026 (US-SALES-023, Fase 3 do mesmo plano): crédito ou débito obrigatório no pagamento em cartão da venda e da contribuição (seletor em `CamposPagamento`; no PDV, pelo botão escolhido), "Cartão de crédito/débito" no comprovante, no recibo e na revisão, relatório de vendas com os dois tipos e liquidação de cartão com o saldo a receber por tipo e o tipo liquidado opcional.

---

## Fase 11 — Financeiro (telas adicionais) — Jornada D

**Intent:** completar tesouraria, conciliação e fechamento.

**Expected Outcomes:** fila de aprovação de gastos (com ajuste do valor total, sem aprovação parcial por item), lançamentos financeiros, transferências internas, liquidação de cartão (bruto, taxa, líquido; validação contra saldo de Cartão a receber), saldos por conta, conciliação bancária manual, contas de recebimento por forma de pagamento, fechamento mensal com checklist e reabertura (somente Administrador, com justificativa).

**Todo List:**
1. Criar fila de aprovação e tela de decisão.
2. Criar lançamentos, transferências internas e saldos por conta.
3. Criar liquidação de cartão com validações.
4. Criar conciliação com tratamento de divergências e trilha de auditoria.
5. Criar fechamento mensal com checklist de pré-requisitos e reabertura.
6. Testes das validações e do checklist de fechamento.

**Relevant Context:** descrição seção 3 (Jornadas C e D), seção 4 (Contas financeiras, Cartão), seção 6 (Financeiro).

**Status:** `[x] done` — Gestão financeira entregue (US-FINANCIAL-001 a 005, 009, 010, 015, 021 e 022, `features/financeiro`): página Financeiro com saldos por tipo de conta, subtotais, total e "saldo na data" (só Tesoureiro e Administrador); cadastro de contas pelo Administrador (código gerado do nome, saldo inicial e data de corte travados após o primeiro lançamento, inativação só com saldo zero, exclusão só sem lançamentos); transferência interna; liquidação de cartão com líquido calculado e bloqueio do bruto acima de Cartão a receber; lançamento manual com categoria → subcategoria (sem as de fluxo próprio), anexo opcional e confirmação; lista de lançamentos com filtros, saldo anterior, saldo corrido, saldo final e "Carregar mais 50"; detalhe com estorno (motivo ≥ 10 caracteres e correção opcional ligada ao original) e reclassificação com histórico; contas de recebimento (o Administrador define o caixa do dinheiro e a conta do PIX; o fechamento de caixa saiu em 26/10/2026); painel do Tesoureiro (wireframe 3). Os mocks das contribuições e vendas passaram a lançar no razão simulado de `mocks/bancoFinanceiro.ts`. A fila de aprovação de gastos veio com a Fase 6 (US-EXPENSE). Conciliação bancária entregue (US-RECONCILIATION-001, 003, 005, 007 e 010, `features/conciliacao`, rotas `/conciliacao/...`, item "Conciliação" no menu do Tesoureiro e do Administrador, que também concilia, confirma o cartão e fecha o mês (decisão do responsável pelo produto, alinhada à matriz da US-AUTH-002) e botão "Conciliação bancária" no Financeiro para a Tesouraria): tela inicial no padrão de tabela do wireframe 10 com cada conta bancária ativa, "conciliada até", saldo conciliado, não conciliados e a sessão em andamento (retomada com "Continuar"); início pedindo data final (posterior à última conciliação, não futura) e saldo final do extrato; sessão com a lista dos não conciliados até a data final, marcação em um clique gravada na hora (em série, com quem marcou e quando), "Marcar todos os exibidos" sobre a lista filtrada, filtros de período, valor, texto e "Mostrar marcados", paginação, e o painel "Resumo" sempre visível no padrão do wireframe 7 (saldo conciliado anterior, total marcado, saldo pelo sistema, saldo do extrato e diferença); "Corrigir" abre o estorno do Financeiro (US-FINANCIAL-010) e o estorno/correção entram na lista; "Adicionar lançamento ausente" (receita ou despesa com a sugestão Taxas bancárias/Outras entradas, ou transferência entre contas próprias) já entra marcado e sinalizado; "Alterar dados do extrato" desmarca o que ficou depois da nova data; "Concluir" só com diferença R$ 0,00 e confirmação; histórico por conta e relatório imprimível (conciliados, adicionados, correções e pendentes). O painel do Tesoureiro passou a abrir a conciliação pelo atalho "Conciliar conta" e pela pendência de cada banco, com a data da última conciliação. Mocks em `mocks/bancoConciliacoes.ts`, ligados ao razão simulado. Importação do extrato (US-RECONCILIATION-012, antecipada do backlog Could a pedido do responsável pelo produto): botão "Importar extrato (OFX/CSV)" na sessão, leitura do arquivo no navegador (`leitorExtrato.ts`: OFX SGML/XML, CSV com separador detectado, colunas sugeridas e ajustáveis, Crédito/Débito separados, linhas de saldo ignoradas, UTF-8 ou Windows-1252), prévia com período, total e o que fica fora da sessão, opção de usar o saldo e a data do OFX; abas "Extrato do banco" e "Lançamentos do sistema"; cada linha conferida, com sugestão (mesmo valor, até 3 dias, já selecionada para confirmar), sem lançamento ("Adicionar" abre o lançamento ausente preenchido e ligado à linha) ou depois do fim do extrato; "Desfazer" o par desmarca o lançamento. Fechamento mensal entregue (US-CLOSING-001, 007, 008, 009 e 013, `features/fechamento`, rotas `/fechamento` e `/fechamento/:mes/demonstrativo`, item "Fechamento mensal" no menu do Tesoureiro e do Administrador, que também o vê entre os atalhos do painel como no wireframe 4): checklist do mês mais antigo aberto no padrão de "Pendências do período" do wireframe 3 (conciliação, intenções, solicitações de estoque com "Aguardando o Administrador", editoras e confirmação das liquidações de cartão com o saldo de Cartão a receber no fim do mês e a última liquidação), cada item com a contagem e o link para a tela que o resolve; "Fechar período" só com tudo concluído, com confirmação e nota opcional; mês atual em andamento (só leitura); lista dos períodos com situação, quem fechou, versões, histórico e "Reabrir" (só o Administrador, só o mais recente, justificativa de 20 caracteres ou mais); aviso "Período mm/aaaa reaberto por … em …" no shell para todos os perfis; demonstrativo consolidado no layout do wireframe 12 (indicadores de saldo inicial, receitas, despesas e saldo final; receitas e despesas por categoria e subcategoria com barra de participação, mês anterior, diferença em R$ e %, destaque para variação acima de 20% e de R$ 100,00; resultado sem transferências; saldos por conta com transferências à parte; obrigações com editoras fora do resultado; mensalidades), marcado como preliminar ou "Fechado em … por …" com seletor de versão e impressão pelo navegador. O painel do Tesoureiro passou a mostrar o checklist nas pendências e o atalho "Fechamento mensal" com o contador. A trava dos meses fechados vale nos mocks de lançamentos, reclassificação, conciliação, remessas, devoluções e transferência de saldo das editoras (`mocks/travaPeriodo.ts`); o estorno do que aconteceu num mês fechado cai hoje. Mocks em `mocks/bancoFechamento.ts`. A exportação Excel/PDF do demonstrativo veio depois, com o módulo Relatórios (US-REPORT-021, Fase 13). Janela de fechamento (US-CLOSING-014, pedido do responsável pelo produto): Configurações → "Janela de fechamento" (`/administracao/fechamento`, `features/fechamento/pages/JanelaFechamentoPage.tsx`), para o Tesoureiro (único item de Configurações que ele vê) e o Administrador, com primeiro e último dia (de 1 a 7 dias seguidos, até o dia 28, padrão 1 a 7); o "Fechar período" só se habilita dentro da janela, a página do fechamento mostra a janela com "Alterar janela" e, com o checklist concluído fora dela, o aviso "Fora da janela de fechamento" com a próxima janela. Em 27/10/2026 (Fase 2 do [plano de melhorias](enhancements/plano-melhorias-2026-10-27.md)): campos em reais (`CampoValor`) aceitam só dígitos e um separador decimal com até duas casas; o diálogo de ação (`DialogoAcao`) rola até o primeiro campo inválido e o foca ao confirmar; no lançamento ausente, valor e descrição vêm logo após o tipo; a aprovação de gasto avisa antes de confirmar quando a conta bancária vai ficar negativa; subcategorias Aluguel e Seguro; conta a pagar única paga aparece como "Quitada" e volta a ficar em aberto com o estorno.

---

## Fase 12 — Editoras e livros consignados

**Intent:** entregar o módulo Editoras.

**Expected Outcomes:** cadastro de editora e título, nova remessa (código gerado automaticamente, percentual de repasse por título/remessa), devolução por remessa, apuração mensal, pagamento parcial, saldo pendente por editora com transferência ao período seguinte.

**Todo List:**
1. Criar listagem e cadastro de editoras e títulos.
2. Criar remessa com código automático e percentual de repasse.
3. Criar devolução por remessa e apuração mensal.
4. Criar pagamento parcial e visão de saldo pendente.
5. Testes de cálculo de apuração (FIFO simulado) e pagamentos parciais.

**Relevant Context:** descrição seção 4 (Livros consignados), seção 6 (Editoras).

**Status:** `[x] done` — histórias US-PUBLISHER-001, 003, 005 a 008 e 010 (`features/editoras`, rotas `/editoras/...`, menu "Editoras" do Vendedor, do Tesoureiro e do Administrador; desde 26/10/2026 cadastro, remessas e devoluções são do Vendedor e a Tesouraria faz os pedidos de livros em `/editoras/pedidos`, recebidos pela remessa com conferência). Lista no padrão do wireframe 10 com abas "Editoras" e "Remessas" (busca, filtros, status, paginação); cadastro de editora pelo Administrador (CNPJ validado e único, contato e dados de pagamento, inativação e exclusão só sem remessas) e página da editora com saldo devido, último pagamento e remessas abertas; registro de remessa em tabela editável (wireframe 9) com percentual de repasse pré-preenchido pelo padrão do título e código gerado (R-AAAA-NNNN); página da remessa com recebidas, vendidas, devolvidas, baixadas, restantes e obrigações por título, cancelamento só sem movimentos e devolução por título (até o restante, sem lançamento) com comprovante imprimível para assinatura; saldo devido por editora com total, detalhe das obrigações (abertas, pagas e estornadas, com o crédito de venda cancelada) e pagamentos; pagamento parcial do Tesoureiro com a alocação das mais antigas para as mais novas mostrada antes de confirmar, crédito aplicado antes do dinheiro, despesa "Repasse às editoras" e recibo imprimível; apuração mensal imprimível (seção financeira, estoque por remessa e título, vendas, baixas, estornos, devoluções e pagamentos, com o saldo transferido do mês anterior); etapa "Editoras" do fechamento com transferência formal do saldo (nota obrigatória). O atalho "Pagar editoras" e a pendência "Acertos com editoras" do painel do Tesoureiro passaram a funcionar. Editoras, remessas e obrigações simuladas ficam em `mocks/cadastroEditoras.ts`, compartilhadas com Estoque e Vendas; o estorno da despesa no Financeiro reabre as obrigações. Divergências: a apuração tem impressão pelo navegador e, desde a Fase 13, "Exportar" para Excel e PDF (US-REPORT-021); a etapa "Editoras" do fechamento é uma tela própria em `/editoras/fechamento`, para onde aponta o item "Editoras" do checklist do fechamento mensal.

---

## Fase 13 — Relatórios restantes, cadastros e configurações

**Intent:** fechar o mapa de telas.

**Expected Outcomes:** relatórios de fluxo de caixa, receitas/despesas por categoria, saldos por conta, mensalidades, vendas, estoque, acertos com editoras, demonstrativo mensal consolidado (com comparação ao mês anterior) e exportação Excel/PDF; telas administrativas de usuários, plano de contas (categorias usadas só podem ser inativadas), valor futuro da mensalidade e modelos de mensagens.

**Todo List:**
1. Criar relatórios com filtros de período e conta, reutilizando componentes da Fase 7.
2. Criar exportação simulada Excel/PDF.
3. Criar telas de usuários, plano de contas, mensalidade e modelos de mensagem.
4. Testes das regras de inativação do plano de contas e da vigência futura da mensalidade.

**Relevant Context:** descrição seção 4 (Mensalidades, Plano de contas), seção 5, seção 6 (Relatórios).

**Status:** `[x] done` — Relatórios entregues (US-REPORT-001 a 004, 006, 007, 009 e 021, `features/relatorios`, rotas `/relatorios/...`, item "Relatórios" no menu do Vendedor, do Tesoureiro e do Administrador): índice com os relatórios do perfil (Tesouraria todos; Vendedor vendas, estoque e folha de contagem; Operador nenhum — divergência do wireframe, que mostra "Relatórios" também no menu do Operador, conforme as regras comuns da US-REPORT); todos no padrão do wireframe 12, com filtro de período (mês por padrão ou intervalo), filtros guardados na URL e "Exportar ▾" (Excel/PDF do servidor, com os filtros da tela e registro na auditoria). Fluxo de caixa (todas as contas, um tipo ou uma conta; agrupamento por dia, semana ou mês; entradas e saídas por categoria, transferências à parte, saldo final igual ao das contas); receitas e despesas por categoria (plano de contas inteiro, inativas com lançamento, participação e resultado; desde 27/10/2026, Fase 4 do [plano de melhorias](enhancements/plano-melhorias-2026-10-27.md), também o indicador "Devido às editoras (saldo atual)" ao lado do resultado, de `editoraService.saldos()`, com nota do regime de caixa e link para Acertos com editoras, e a seção "Editoras" na exportação); saldos por conta (período ou "saldo na data", por tipo, Cartão a receber à parte, "conciliada até"); mensalidades (competências por mês com taxa de pagamento, recebido em atrasadas/do mês/antecipadas, doadores com 3 ou mais pendentes); vendas (totais, canceladas, receita líquida, meios, produtos e vendedores); estoque (por produto e origem, baixas por motivo) e folha de contagem imprimível; acertos com editoras com link para a apuração. Drill-down: categorias e períodos abrem os Lançamentos já filtrados (que passaram a aceitar `de`, `ate`, `categoria`, `natureza` e `contaId` na URL), cancelamentos abrem a lista de Vendas (`de`, `ate`, `status`) e produtos abrem o histórico de movimentos (`de`, `ate`). "Exportar" também no demonstrativo, na apuração da editora, no relatório da conciliação e na lista de lançamentos. Mocks em `mocks/bancoRelatorios.ts` (mesmo cálculo do backend) e `mocks/exportacaoRelatorios.ts` (PDF e .xlsx mínimos). Cadastros e configurações entregues com o módulo Administração (US-ADMIN-001 a 005, 009 e 012, `features/administracao`, item "Configurações" no menu do Administrador como no wireframe 4, rotas `/administracao/...`): usuários e papéis do Keycloak só para leitura com "Gerenciar no Keycloak"; valor da mensalidade com histórico e um agendamento por vez a partir do mês seguinte (os mocks de competências usam o valor de cada mês); modelos de agradecimento e aniversário com chips de variáveis, pré-visualização e variável desconhecida bloqueada (usados pelo agradecimento da contribuição e pelos aniversariantes); plano de contas (também lido pelo Tesoureiro); dados da organização com logotipo (usados nos recibos e relatórios simulados); auditoria com filtros na URL e o botão "Histórico" nas páginas de doador, comprovante, venda, intenção, lançamento, remessa, produto e editora (divergência: diálogo em vez de aba); importação do histórico financeiro e de doadores em CSV com prévia, erros por linha, decisão das duplicatas e desfazer. O perfil em uso vai em `X-Perfil-Ativo` e entrada/saída vão para a auditoria. Mocks em `mocks/bancoAdministracao.ts` e `mocks/tabelaMensalidade.ts`.

---

## Fase 14 — Qualidade final e preparação para integração

**Intent:** estabilizar o frontend e documentar os pontos de integração com backend e Keycloak.

**Expected Outcomes:**
- Suíte de testes verde, build de produção limpo, sem warnings de lint/tipos.
- Documento listando os contratos dos serviços (`src/services`) a serem implementados pelo backend e o ponto de troca do `AuthService` simulado por Keycloak.
- Roteiro de validação com os 4 participantes (seção 9 da descrição) executável com os mocks.

**Todo List:**
1. Cobrir lacunas de testes dos fluxos críticos (contribuição, venda, aprovação de gasto).
2. Revisar responsividade e acessibilidade nas telas principais.
3. Documentar contratos de serviços e estratégia de substituição de mocks/auth.
4. Validar o roteiro de tarefas por perfil (Operador, Vendedor, Tesoureiro, Administrador).

**Relevant Context:** descrição seções 8 e 9.

**Status:** `[ ] pending`
