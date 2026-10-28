import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom'
import { AuditoriaPage } from '../features/administracao/pages/AuditoriaPage'
import { ConfiguracoesPage } from '../features/administracao/pages/ConfiguracoesPage'
import { JanelaFechamentoPage } from '../features/fechamento/pages/JanelaFechamentoPage'
import { ImportacaoPage } from '../features/administracao/pages/ImportacaoPage'
import { MensalidadePage } from '../features/administracao/pages/MensalidadePage'
import { ModelosMensagemPage } from '../features/administracao/pages/ModelosMensagemPage'
import { OrganizacaoPage } from '../features/administracao/pages/OrganizacaoPage'
import { PlanoContasPage } from '../features/administracao/pages/PlanoContasPage'
import { UsuariosPage } from '../features/administracao/pages/UsuariosPage'
import { CadastroContasPagarPage } from '../features/contaspagar/pages/CadastroContasPagarPage'
import { ContaPagarFormPage } from '../features/contaspagar/pages/ContaPagarFormPage'
import { ContaPagarPage } from '../features/contaspagar/pages/ContaPagarPage'
import { ContasPagarPage } from '../features/contaspagar/pages/ContasPagarPage'
import { ConciliacaoPage } from '../features/conciliacao/pages/ConciliacaoPage'
import { HistoricoConciliacoesPage } from '../features/conciliacao/pages/HistoricoConciliacoesPage'
import { SessaoConciliacaoPage } from '../features/conciliacao/pages/SessaoConciliacaoPage'
import { DoacaoAnonimaPage } from '../features/contribuicoes/pages/DoacaoAnonimaPage'
import { LocalizarReciboPage } from '../features/contribuicoes/pages/LocalizarReciboPage'
import { ReciboPage } from '../features/contribuicoes/pages/ReciboPage'
import { RegistrarContribuicaoPage } from '../features/contribuicoes/pages/RegistrarContribuicaoPage'
import { AniversariantesPage } from '../features/doadores/pages/AniversariantesPage'
import { BuscaDoadorPage } from '../features/doadores/pages/BuscaDoadorPage'
import { CadastroRapidoPage } from '../features/doadores/pages/CadastroRapidoPage'
import { PerfilDoadorPage } from '../features/doadores/pages/PerfilDoadorPage'
import { EntradaDoacaoPage } from '../features/estoque/pages/EntradaDoacaoPage'
import { EstoquePage } from '../features/estoque/pages/EstoquePage'
import { ProdutoFormPage } from '../features/estoque/pages/ProdutoFormPage'
import { ProdutoPage } from '../features/estoque/pages/ProdutoPage'
import { SolicitacoesPage } from '../features/estoque/pages/SolicitacoesPage'
import { ApuracaoPage } from '../features/editoras/pages/ApuracaoPage'
import { DevolucaoPage } from '../features/editoras/pages/DevolucaoPage'
import { EditoraFormPage } from '../features/editoras/pages/EditoraFormPage'
import { EditoraPage } from '../features/editoras/pages/EditoraPage'
import { EditorasPage } from '../features/editoras/pages/EditorasPage'
import { FechamentoEditorasPage } from '../features/editoras/pages/FechamentoEditorasPage'
import { NovaRemessaPage } from '../features/editoras/pages/NovaRemessaPage'
import { NovoPedidoLivrosPage } from '../features/editoras/pages/NovoPedidoLivrosPage'
import { PagamentoEditoraPage } from '../features/editoras/pages/PagamentoEditoraPage'
import { PedidoLivrosPage } from '../features/editoras/pages/PedidoLivrosPage'
import { PedidosLivrosPage } from '../features/editoras/pages/PedidosLivrosPage'
import { ReciboPagamentoPage } from '../features/editoras/pages/ReciboPagamentoPage'
import { RemessaPage } from '../features/editoras/pages/RemessaPage'
import { SaldoEditoraPage } from '../features/editoras/pages/SaldoEditoraPage'
import { SaldosEditorasPage } from '../features/editoras/pages/SaldosEditorasPage'
import { ContaFormPage } from '../features/financeiro/pages/ContaFormPage'
import { ContasPage } from '../features/financeiro/pages/ContasPage'
import { FinanceiroPage } from '../features/financeiro/pages/FinanceiroPage'
import { LancamentoManualPage } from '../features/financeiro/pages/LancamentoManualPage'
import { LancamentoPage } from '../features/financeiro/pages/LancamentoPage'
import { LancamentosPage } from '../features/financeiro/pages/LancamentosPage'
import { LiquidacaoCartaoPage } from '../features/financeiro/pages/LiquidacaoCartaoPage'
import { TransferenciaPage } from '../features/financeiro/pages/TransferenciaPage'
import { DemonstrativoPage } from '../features/fechamento/pages/DemonstrativoPage'
import { FechamentoMensalPage } from '../features/fechamento/pages/FechamentoMensalPage'
import { FilaAprovacaoPage } from '../features/intencoes/pages/FilaAprovacaoPage'
import { IntencaoPage } from '../features/intencoes/pages/IntencaoPage'
import { MinhasIntencoesPage } from '../features/intencoes/pages/MinhasIntencoesPage'
import { NovaIntencaoPage } from '../features/intencoes/pages/NovaIntencaoPage'
import { RecebimentosPage } from '../features/intencoes/pages/RecebimentosPage'
import { AcertosEditorasPage } from '../features/relatorios/pages/AcertosEditorasPage'
import { ContagemEstoquePage } from '../features/relatorios/pages/ContagemEstoquePage'
import { EstoqueRelatorioPage } from '../features/relatorios/pages/EstoqueRelatorioPage'
import { FluxoCaixaPage } from '../features/relatorios/pages/FluxoCaixaPage'
import { MensalidadesPage } from '../features/relatorios/pages/MensalidadesPage'
import { ReceitasDespesasPage } from '../features/relatorios/pages/ReceitasDespesasPage'
import { RelatoriosPage } from '../features/relatorios/pages/RelatoriosPage'
import { SaldosContasPage } from '../features/relatorios/pages/SaldosContasPage'
import { VendasRelatorioPage } from '../features/relatorios/pages/VendasRelatorioPage'
import { ListaVendasPage } from '../features/vendas/pages/ListaVendasPage'
import { NovaVendaPage } from '../features/vendas/pages/NovaVendaPage'
import { PdvCantinaPage } from '../features/vendas/pages/PdvCantinaPage'
import { VendaPage } from '../features/vendas/pages/VendaPage'
import { HomePage } from './HomePage'
import { LoginPage } from './LoginPage'
import { RequireRole } from './RequireRole'
import { Shell } from './Shell'

const DOADORES = ['operador', 'administrador'] as const
const RECIBOS = ['operador', 'tesoureiro', 'administrador'] as const
/** O Vendedor abre só os recibos das doações que registrou (regra no backend). */
const RECIBO = [...RECIBOS, 'vendedor'] as const
const VENDAS = ['vendedor', 'tesoureiro', 'administrador'] as const
const ESTOQUE = ['vendedor', 'tesoureiro', 'administrador'] as const
const ESTOQUISTAS = ['vendedor', 'administrador'] as const
const TESOURARIA = ['tesoureiro', 'administrador'] as const

export const rotas: RouteObject[] = [
  { path: '/entrar', element: <LoginPage /> },
  {
    element: (
      <RequireRole>
        <Shell />
      </RequireRole>
    ),
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'doadores',
        element: <RequireRole papeis={[...DOADORES]} />,
        children: [
          { index: true, element: <BuscaDoadorPage /> },
          { path: 'novo', element: <CadastroRapidoPage /> },
          { path: ':id', element: <PerfilDoadorPage /> },
        ],
      },
      {
        path: 'aniversariantes',
        element: (
          <RequireRole papeis={['operador', 'administrador']}>
            <AniversariantesPage />
          </RequireRole>
        ),
      },
      {
        path: 'contribuicoes',
        children: [
          {
            index: true,
            element: (
              <RequireRole papeis={[...RECIBOS]}>
                <LocalizarReciboPage />
              </RequireRole>
            ),
          },
          {
            element: <RequireRole papeis={['operador']} />,
            children: [
              { path: 'nova', element: <RegistrarContribuicaoPage /> },
              { path: 'nova/:doadorId', element: <RegistrarContribuicaoPage /> },
            ],
          },
          {
            path: 'anonima',
            element: (
              <RequireRole papeis={['operador', 'vendedor']}>
                <DoacaoAnonimaPage />
              </RequireRole>
            ),
          },
          {
            path: ':id',
            element: (
              <RequireRole papeis={[...RECIBO]}>
                <ReciboPage />
              </RequireRole>
            ),
          },
        ],
      },
      {
        path: 'vendas',
        children: [
          {
            index: true,
            element: (
              <RequireRole papeis={[...VENDAS]}>
                <ListaVendasPage />
              </RequireRole>
            ),
          },
          {
            path: 'nova',
            element: (
              <RequireRole papeis={['vendedor']}>
                <NovaVendaPage />
              </RequireRole>
            ),
          },
          {
            path: 'pdv',
            element: (
              <RequireRole papeis={['vendedor', 'pdv']}>
                <PdvCantinaPage />
              </RequireRole>
            ),
          },
          {
            path: ':id',
            element: (
              <RequireRole papeis={[...VENDAS]}>
                <VendaPage />
              </RequireRole>
            ),
          },
        ],
      },
      {
        path: 'estoque',
        children: [
          {
            element: <RequireRole papeis={[...ESTOQUE]} />,
            children: [
              { index: true, element: <EstoquePage /> },
              { path: 'produtos/:id', element: <ProdutoPage /> },
            ],
          },
          {
            element: <RequireRole papeis={[...ESTOQUISTAS]} />,
            children: [
              { path: 'produtos/novo', element: <ProdutoFormPage /> },
              { path: 'produtos/:id/editar', element: <ProdutoFormPage /> },
              { path: 'entrada-doacao', element: <EntradaDoacaoPage /> },
              { path: 'solicitacoes', element: <SolicitacoesPage /> },
            ],
          },
        ],
      },
      {
        path: 'financeiro',
        children: [
          {
            element: <RequireRole papeis={[...TESOURARIA]} />,
            children: [
              { index: true, element: <FinanceiroPage /> },
              { path: 'lancamentos', element: <LancamentosPage /> },
              { path: 'lancamentos/:id', element: <LancamentoPage /> },
              { path: 'contas', element: <ContasPage /> },
              { path: 'contas/nova', element: <ContaFormPage /> },
              { path: 'contas/:id/editar', element: <ContaFormPage /> },
            ],
          },
          {
            element: <RequireRole papeis={['tesoureiro']} />,
            children: [
              { path: 'transferencia', element: <TransferenciaPage /> },
              { path: 'liquidacao-cartao', element: <LiquidacaoCartaoPage /> },
              { path: 'lancamentos/novo', element: <LancamentoManualPage /> },
            ],
          },
        ],
      },
      {
        path: 'contas-pagar',
        element: <RequireRole papeis={[...TESOURARIA]} />,
        children: [
          { index: true, element: <ContasPagarPage /> },
          { path: 'cadastro', element: <CadastroContasPagarPage /> },
          { path: 'nova', element: <ContaPagarFormPage /> },
          { path: ':id', element: <ContaPagarPage /> },
          { path: ':id/editar', element: <ContaPagarFormPage /> },
        ],
      },
      {
        path: 'conciliacao',
        element: <RequireRole papeis={[...TESOURARIA]} />,
        children: [
          { index: true, element: <ConciliacaoPage /> },
          { path: 'historico', element: <HistoricoConciliacoesPage /> },
          { path: ':id', element: <SessaoConciliacaoPage /> },
        ],
      },
      {
        path: 'fechamento',
        element: <RequireRole papeis={[...TESOURARIA]} />,
        children: [
          { index: true, element: <FechamentoMensalPage /> },
          { path: ':mes/demonstrativo', element: <DemonstrativoPage /> },
        ],
      },
      {
        path: 'intencoes-gasto',
        children: [
          {
            element: <RequireRole papeis={['vendedor']} />,
            children: [
              { index: true, element: <MinhasIntencoesPage /> },
              { path: 'nova', element: <NovaIntencaoPage /> },
            ],
          },
          {
            path: 'aprovacao',
            element: (
              <RequireRole papeis={[...TESOURARIA]}>
                <FilaAprovacaoPage />
              </RequireRole>
            ),
          },
          {
            path: 'recebimentos',
            element: (
              <RequireRole papeis={['vendedor']}>
                <RecebimentosPage />
              </RequireRole>
            ),
          },
          {
            path: ':id',
            element: (
              <RequireRole papeis={[...VENDAS]}>
                <IntencaoPage />
              </RequireRole>
            ),
          },
        ],
      },
      {
        path: 'editoras',
        children: [
          {
            // Cadastro, remessas e devoluções são do Vendedor; a Tesouraria consulta e pede livros.
            element: <RequireRole papeis={[...VENDAS]} />,
            children: [
              { index: true, element: <EditorasPage /> },
              { path: ':id', element: <EditoraPage /> },
              { path: 'remessas/:id', element: <RemessaPage /> },
              { path: 'devolucoes/:id', element: <DevolucaoPage /> },
              { path: 'pedidos/:id', element: <PedidoLivrosPage /> },
            ],
          },
          {
            element: <RequireRole papeis={[...TESOURARIA]} />,
            children: [
              { path: ':id/saldo', element: <SaldoEditoraPage /> },
              { path: ':id/apuracao', element: <ApuracaoPage /> },
              { path: 'saldos', element: <SaldosEditorasPage /> },
              { path: 'pagamentos/:id', element: <ReciboPagamentoPage /> },
              { path: 'fechamento', element: <FechamentoEditorasPage /> },
              { path: 'pedidos', element: <PedidosLivrosPage /> },
              { path: 'pedidos/novo', element: <NovoPedidoLivrosPage /> },
            ],
          },
          {
            element: <RequireRole papeis={['vendedor', 'administrador']} />,
            children: [
              { path: 'nova', element: <EditoraFormPage /> },
              { path: ':id/editar', element: <EditoraFormPage /> },
              { path: 'remessas/nova', element: <NovaRemessaPage /> },
            ],
          },
          {
            path: 'pagamento',
            element: (
              <RequireRole papeis={['tesoureiro']}>
                <PagamentoEditoraPage />
              </RequireRole>
            ),
          },
        ],
      },
      {
        // US-REPORT: a Tesouraria vê todos; o Vendedor, vendas e estoque; o Operador, nenhum.
        path: 'relatorios',
        children: [
          {
            element: <RequireRole papeis={[...VENDAS]} />,
            children: [
              { index: true, element: <RelatoriosPage /> },
              { path: 'vendas', element: <VendasRelatorioPage /> },
              { path: 'estoque', element: <EstoqueRelatorioPage /> },
              { path: 'estoque/contagem', element: <ContagemEstoquePage /> },
            ],
          },
          {
            element: <RequireRole papeis={[...TESOURARIA]} />,
            children: [
              { path: 'fluxo-caixa', element: <FluxoCaixaPage /> },
              { path: 'receitas-despesas', element: <ReceitasDespesasPage /> },
              { path: 'saldos', element: <SaldosContasPage /> },
              { path: 'mensalidades', element: <MensalidadesPage /> },
              { path: 'editoras', element: <AcertosEditorasPage /> },
            ],
          },
        ],
      },
      {
        // US-ADMIN: configurações do Administrador; o plano de contas também é lido pela Tesouraria.
        path: 'administracao',
        children: [
          {
            path: 'plano-contas',
            element: (
              <RequireRole papeis={[...TESOURARIA]}>
                <PlanoContasPage />
              </RequireRole>
            ),
          },
          {
            // US-CLOSING-014: o Tesoureiro vê nas Configurações só a janela de fechamento.
            element: <RequireRole papeis={[...TESOURARIA]} />,
            children: [
              { index: true, element: <ConfiguracoesPage /> },
              { path: 'fechamento', element: <JanelaFechamentoPage /> },
            ],
          },
          {
            element: <RequireRole papeis={['administrador']} />,
            children: [
              { path: 'usuarios', element: <UsuariosPage /> },
              { path: 'mensalidade', element: <MensalidadePage /> },
              { path: 'mensagens', element: <ModelosMensagemPage /> },
              { path: 'organizacao', element: <OrganizacaoPage /> },
              { path: 'auditoria', element: <AuditoriaPage /> },
              { path: 'importacao', element: <ImportacaoPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]

export const criarRoteador = () => createBrowserRouter(rotas)
export const criarRoteadorEmMemoria = (entradas: string[]) =>
  createMemoryRouter(rotas, { initialEntries: entradas })
