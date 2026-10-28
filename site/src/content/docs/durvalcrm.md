---
titulo: DurvalCRM
descricao: Gestão de doadores, mensalidades, vendas, estoque, editoras e tesouraria, com prestação de contas.
secao: Soluções
ordem: 11
---

O **DurvalCRM** (pasta `02-durval-crm`) é o sistema de gestão da casa. Ele substitui os controles em papel e planilhas de doações, livraria, cantina e tesouraria, e gera a prestação de contas mensal.

## Perfis

| Perfil | O que faz |
|---|---|
| Operador | Atende doadores, registra mensalidades e doações, emite recibos e agradecimentos |
| Vendedor | Vende livros e itens da cantina, cuida do estoque e das remessas das editoras |
| PDV | Opera só o ponto de venda da cantina |
| Tesoureiro | Contas, lançamentos, conciliação bancária, contas a pagar e fechamento do mês |
| Administrador | Tudo isso, mais configurações, plano de contas, auditoria e reabertura de meses |

Uma pessoa pode acumular perfis e escolher com qual está trabalhando.

## Módulos

| Módulo | Destaques |
|---|---|
| Doadores | Busca, cadastro rápido com checagem de duplicidade, consentimentos, aniversariantes, notas e anonimização (LGPD) |
| Contribuições | Mensalidades geradas todo mês, escolha das competências a pagar (inclusive antecipadas), pagamento misto, doação extraordinária e anônima, recibo em PDF (A4 e bobina 80 mm) |
| Vendas | Carrinho de livros e cantina, pagamento misto (dinheiro, PIX, cartão de crédito ou débito), comprovante, cancelamento com estorno e PDV da cantina |
| Estoque | Livros (ISBN validado) e cantina, estoque próprio e consignado, entrada por doação, pedidos de baixa e de preço com aprovação, ajuste após contagem |
| Editoras | Pedidos de livros, remessas consignadas, devoluções, saldo devido, apuração mensal e pagamentos parciais |
| Financeiro | Caixas e contas bancárias, transferências, liquidação de cartão, lançamentos com anexo, estorno e reclassificação |
| Intenções de gasto | Pedido de compra com justificativa e anexos, aprovação pela tesouraria com despesa automática e conferência do recebimento |
| Contas a pagar | Despesas únicas, mensais ou anuais, agenda de vencimentos e pagamento com lançamento automático |
| Conciliação bancária | Importação do extrato (OFX/CSV) com sugestão de pares, conclusão só com diferença zero |
| Fechamento mensal | Checklist do mês, janela de fechamento, demonstrativo versionado e reabertura justificada |
| Relatórios | Fluxo de caixa, receitas e despesas, saldos, mensalidades, vendas, estoque e editoras, exportados em Excel e PDF |
| Administração | Usuários e perfis, valor da mensalidade, modelos de mensagem, plano de contas, dados da organização, auditoria e importação de histórico |

## Regras que dão confiança aos números

- **Nada se apaga**: cancelamentos e correções viram estornos ligados ao lançamento original, sempre auditados.
- **Regime de caixa**: a receita entra na data do recebimento, não na competência.
- **Transferências internas** nunca são receita nem despesa.
- **Mês fechado é travado**: nada entra num período fechado; só o administrador reabre, com justificativa.
- **Auditoria só de inserção**: o banco bloqueia alteração e exclusão do log.

## Tecnologia

- **Backend**: Java 21, Spring Boot 4 (WAR no Tomcat 11), Clean Architecture + DDD tático em monólito modular, PostgreSQL com migrações Flyway, fronteiras verificadas por ArchUnit, testes com JUnit e Testcontainers.
- **Frontend**: React + TypeScript + Vite, **Material UI** (somente componentes gratuitos), gráficos com MUI X Charts, mocks com MSW, testes com Vitest e Testing Library. Responsivo *mobile-first*.
- **Login** pelo Keycloak da Comunidade Cairbar (client público com PKCE).
