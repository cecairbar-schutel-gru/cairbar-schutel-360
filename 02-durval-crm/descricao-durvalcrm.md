1. Visão do produto

Uma plataforma integrada para organizações sem fins lucrativos gerenciarem:

relacionamento com doadores recorrentes;
mensalidades e doações;
vendas de livros e produtos da cantina;
estoque próprio e consignado;
intenções de gasto e aprovações;
fluxo de caixa;
conciliação bancária;
repasses às editoras;
prestação de contas.
Proposta de valor

Substituir controles fragmentados em papel e planilhas por uma operação rastreável, simples e integrada, conectando relacionamento com doadores, movimentação financeira, vendas e estoque.

2. Perfis do MVP
Operador
Localiza e cadastra doadores.
Registra mensalidades e doações.
Seleciona explicitamente as competências quitadas.
Registra pagamentos mistos.
Gera comprovante digital.
Prepara mensagens de WhatsApp ou e-mail.
Consulta aniversariantes.
Cadastra doadores recorrentes.
Agenda atividades para os participantes da comunidade (pós-MVP, devplan/13-activities).
Vendedor
Realiza vendas de livros e cantina.
Consulta estoque.
Confirma recebimento de compras aprovadas.
Registra produto recebido por doação.
Solicita baixas por vencimento, dano ou extravio.
Cadastra produtos da cantina.
Cadastra editoras e títulos (livros), registra as remessas recebidas (contra o pedido de livros, quando houver) e as devoluções.
Solicita alterações de preço e inativação.
Cancela e refaz vendas.
Registra intenções de gasto.
Recebe doações anônimas e vê só os recibos que emitiu.
Tesoureiro
Aprova ou rejeita intenções de gasto.
Confirma valor, data, meio de pagamento e categoria.
Concilia contas bancárias.
Cancela as vendas feitas pelo perfil PDV da cantina.
Corrige divergências com auditoria.
Liquida recebíveis de cartão.
Registra pagamentos às editoras.
Faz pedidos de novos livros às editoras.
Consulta os relatórios de movimentos dos livros (vendas, estoque e acertos com editoras).
Fecha períodos mensais.
Administrador
Mantém doadores, usuários e configurações.
Define o valor futuro da mensalidade.
Define as contas de recebimento de cada forma de pagamento.
Configura modelos de mensagens.
Mantém plano de contas.
Aprova baixas de estoque e mudanças de preço.
Tem acesso completo ao módulo de livros: tudo o que o Vendedor e o Tesoureiro fazem com editoras, títulos, remessas e pedidos.
Consulta todos os relatórios.
Reabre períodos fechados.
Executa anonimização de doadores.

Schutelista (pós-MVP)
Perfil padrão de todo participante da comunidade (autocadastro ou cadastro pelo Operador).
Agenda atividades oferecidas pela organização (devplan/13-activities).

PDV (perfil do tablet da cantina)
Opera só o PDV da cantina, onde vende os produtos da cantina e os livros cadastrados.
Cancela, a qualquer tempo, só a última venda que ele mesmo registrou.

Perfis revisados em 26/10/2026: as intenções de gasto passaram do Operador para o Vendedor, que também recebe doações. Na mesma data saiu o conceito de caixa operacional: quem pode vender ou receber registra direto, sem escolher nem abrir caixa, e cada forma de pagamento entra na conta de recebimento definida pelo Administrador. Também na mesma data: editoras, títulos, remessas e devoluções passaram ao Vendedor; os pedidos de novos livros são só do Tesoureiro e do Administrador; e os livros cadastrados aparecem no PDV da cantina, inclusive para o perfil PDV.

Os perfis e autorizações serão fornecidos pelo Keycloak. Um usuário poderá acumular papéis.

3. Jornadas principais
Jornada A: receber contribuição
Buscar o doador por nome, telefone ou e-mail.
Fazer cadastro rápido se a pessoa não estiver registrada.
Consultar competências pendentes e futuras.
Selecionar explicitamente as competências desejadas.
Classificar eventual excedente.
Dividir o valor entre dinheiro, PIX e cartão (cada forma entra na sua conta de recebimento).
Validar a soma dos meios de pagamento.
Confirmar o recebimento.
Quitar as competências.
Gerar comprovante digital.
Abrir WhatsApp ou e-mail com a mensagem preenchida.
Jornada B: realizar venda
Adicionar livros e produtos da cantina.
Validar disponibilidade em estoque.
Usar o preço fixo vigente.
Informar o meio de pagamento, inclusive misto.
Confirmar a venda.
Gerar a receita nas contas de recebimento de cada forma de pagamento.
Baixar o estoque automaticamente.
Para livros, calcular a obrigação com a editora.
Em cancelamento, reverter as contas, o estoque e a obrigação.
Jornada C: intenção de gasto
Vendedor informa descrição, categoria, subcategoria, valor e justificativa.
Pode anexar orçamento ou comprovante opcional.
Tesoureiro ou administrador analisa.
O aprovador pode ajustar o valor total.
Não existe aprovação parcial por item.
A aprovação gera automaticamente a despesa na conta escolhida pelo aprovador.
Para compras da cantina, o Vendedor confirma depois o recebimento físico.
Se o recebimento divergir da solicitação, a entrada fica bloqueada até correção ou cancelamento.
Jornada D: fechamento mensal
Conciliar as movimentações de todas as contas bancárias.
Resolver divergências.
Processar intenções de gasto pendentes.
Resolver solicitações de ajuste de estoque.
Realizar ou transferir formalmente saldos devidos às editoras.
Liquidar lotes de cartão.
Gerar o demonstrativo consolidado.
Fechar o período.
Se necessário, somente o Administrador poderá reabrir, com justificativa.
4. Regras de negócio centrais
Mensalidades
Valor único para todos os doadores.
Alterações afetam apenas competências futuras.
Competências geradas automaticamente no início de cada mês.
Não existem pagamentos parciais de competência.
O doador escolhe quais competências quer pagar.
Pode haver pagamento antecipado.
A competência não determina a data financeira.
A receita é reconhecida na data do recebimento.
Na inativação, o Administrador decide se mantém ou cancela pendências.
Na reativação, novas competências começam no mês da reativação.
Doações
Doação extraordinária pode receber excedentes de pagamentos.
Doação anônima não fica vinculada a doador ou competência.
Ambas são classificadas inicialmente como Doação geral.
Contas financeiras
Múltiplos caixas (contas de dinheiro em espécie).
Múltiplas contas bancárias.
Cartão a receber.
Contas de recebimento: o Administrador define em qual caixa entra o dinheiro e em qual conta bancária entra o PIX das vendas e contribuições; o cartão entra sempre em Cartão a receber. Quem vende ou recebe não escolhe conta.
Não existe caixa por usuário, abertura ou fechamento de caixa: os usuários que podem vender efetuam as vendas e elas são recebidas contra as contas conforme a forma de pagamento.
PIX é meio de pagamento com entrada direta na conta bancária de recebimento.
Uma conta de recebimento só é inativada depois de o Administrador definir outra.
Transferências internas não são receitas nem despesas.
Cada conta recebe saldo inicial e data de corte.
Cartão
A organização absorve a taxa.
A venda entra pelo valor bruto.
A liquidação informa bruto, taxa e líquido.
A taxa é registrada como despesa.
O líquido entra na conta bancária.
O valor bruto não pode superar o saldo de Cartão a receber.
Venda e contribuição com valor em cartão informam se é crédito ou débito (obrigatório desde 27/10/2026; registros anteriores ficam sem tipo). Crédito e débito entram na mesma conta, Cartão a receber.
Comprovante, recibo e relatório de vendas mostram "Cartão de crédito" ou "Cartão de débito".
A liquidação mostra o saldo a receber dividido em crédito, débito e não informado e aceita o tipo liquidado, opcional, só para conferência; o limite do bruto continua sendo o saldo total.
Vendas e PDV da cantina
O Vendedor vê e cancela só as vendas que fez; Tesoureiro e Administrador veem todas.
No PDV da cantina, tocar no produto só o põe no carrinho; a venda sai pelo botão "Cobrar", com a forma de pagamento escolhida e confirmada explicitamente.
Em dinheiro, o PDV calcula o troco a partir do valor entregue; o troco não é registrado.
O perfil PDV cancela, sem prazo, só a última venda que ele mesmo registrou; se ela já estiver cancelada, não há o que cancelar.
O Tesoureiro cancela qualquer venda feita pelo perfil PDV; o Administrador cancela qualquer venda.
Estoque
Estoque simples, sem custo médio, margem, validade ou lote para cantina.
Venda sem saldo é bloqueada.
Baixas por vencimento, dano e extravio exigem aprovação administrativa.
Entradas de produtos doados atualizam o estoque imediatamente.
Cancelamentos preservam o lançamento original.
Não haverá alerta de estoque mínimo no MVP.
Livros consignados
Cadastro por editora, título e remessa.
Código de remessa gerado automaticamente.
Percentual de repasse registrado por título/remessa.
Alterações de percentual valem apenas para futuras remessas.
Baixa de venda segue FIFO.
Devolução é registrada por remessa.
Devolução não gera movimentação financeira.
Dano ou extravio gera obrigação com a editora, sem gerar receita.
Pagamentos às editoras podem ser parciais.
Saldos remanescentes podem ser transferidos ao período seguinte.
Preços
Preços são fixos no momento da venda.
Administrador altera diretamente preços de livros.
Vendedor pode solicitar alteração de preço de produtos da cantina.
O preço anterior continua vigente até a aprovação.
O novo preço passa a valer imediatamente após a aprovação.
Vendas anteriores nunca são recalculadas.
5. Plano de contas inicial

Estrutura com categoria e apenas um nível de subcategoria.

Receitas de contribuições
Mensalidades
Doações extraordinárias
Doações anônimas
Receitas de vendas
Livros
Cantina
Outras receitas
Outras entradas
Despesas operacionais
Energia elétrica
Água
Internet
Manutenção e conservação
Material de limpeza
Materiais de consumo
Aluguel
Seguro
Despesas comerciais
Compra de produtos da cantina
Repasse às editoras
Taxas de cartão
Outras despesas
Despesas com eventos
Taxas bancárias
Outras saídas

Categorias utilizadas não poderão ser excluídas, apenas inativadas. Mudanças de classificação ficam restritas ao Tesoureiro e Administrador, preservando a classificação anterior.

6. Mapa de telas do wireframe expandido
Painéis
Painel do Operador
Painel do Vendedor
Painel do Tesoureiro
Painel do Administrador
Seletor de perfil para usuários com múltiplos papéis
Doadores
Busca de doador
Cadastro rápido
Cadastro completo
Histórico de competências
Registro de contribuição
Divisão por meios de pagamento
Comprovante digital
Aniversariantes
Inativação, reativação e anonimização
Vendas e estoque
Nova venda
Catálogo de produtos
Estoque disponível
Entrada de compra
Entrada por doação
Solicitação de baixa
Aprovação de baixa
Alteração de preço
Inativação de produto
Histórico de movimentações
Financeiro
Intenção de gasto
Fila de aprovação
Lançamentos financeiros
Transferências internas
Liquidação de cartão
Saldos por conta
Conciliação bancária
Contas de recebimento
Fechamento mensal
Editoras
Cadastro de editora
Cadastro de título
Nova remessa
Devolução por remessa
Apuração mensal
Pagamento parcial
Saldo pendente por editora
Relatórios
Fluxo de caixa
Receitas e despesas por categoria
Ao lado do resultado, o saldo devido hoje às editoras, que em regime de caixa só vira despesa quando é pago (também na exportação).
Saldos por conta
Mensalidades
Vendas
Estoque
Acertos com editoras
Demonstrativo mensal consolidado
Exportação em Excel e PDF
7. Priorização do backlog
Must have
Perfis e permissões via Keycloak.
Cadastro e busca de doadores.
Competências mensais.
Pagamentos mistos.
Comprovante digital.
Doações extraordinárias e anônimas.
Vendas e baixa automática no estoque.
Estoque próprio e consignado.
Intenção e aprovação de gasto.
Regime de caixa.
Contas (caixas de espécie e bancos) e contas de recebimento por forma de pagamento.
Liquidação de cartão.
Conciliação manual.
Fechamento mensal.
Relatórios essenciais.
Auditoria.
Should have
Mensagens pré-preenchidas de agradecimento.
Aniversariantes.
Comparação com o mês anterior.
Importação do histórico financeiro.
Exportação em Excel e PDF.
Demonstrativo mensal consolidado.
Could have depois do MVP
Importação de extrato OFX ou CSV.
Integração bancária.
Envio automático de mensagens.
Controle de lote e validade.
Custo médio e margem.
Metas e orçamento.
Campanhas e centros de custo.
Gestão da agenda e carga dos voluntários.
Cadastro ampliado de habilidades e preferências.
Gestão detalhada de eventos.
8. Critérios de sucesso
Financeiro
Redução de divergências.
Todas as contas conciliadas antes do fechamento.
Separação correta entre resultado financeiro, transferências e obrigações.
Operacional
Eliminação do papel no registro de contribuições.
Ausência de transcrição posterior para planilhas.
Redução de cancelamentos e correções.
Doadores
Competências corretamente acompanhadas.
Comprovante gerado no recebimento.
Agradecimento preparado no canal autorizado.
Comercial
Venda bloqueada sem estoque.
Consistência entre estoque físico e sistema.
Visibilidade do saldo devido às editoras.
Usabilidade

Para cada tarefa do teste, registrar:

se foi concluída;
se houve necessidade de ajuda;
erros e hesitações;
comentários do participante;
melhorias sugeridas.
9. Roteiro de validação

Cada um dos quatro participantes deverá executar uma tarefa representativa:

Operador: registrar duas mensalidades usando PIX e cartão.
Vendedor: vender um livro e dois produtos da cantina.
Tesoureiro: aprovar um gasto, liquidar cartão e conciliar um lançamento.
Administrador: pedir livros a uma editora e aprovar uma baixa de estoque.