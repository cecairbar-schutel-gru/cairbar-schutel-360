import type { TipoConta } from '../financeiro/types'
import type { MeioPagamento } from '../../shared/pagamento/regras'

/** O cartão se divide em crédito e débito; `CARTAO` só nas vendas antigas, sem tipo. */
export type MeioRelatorioVendas = Exclude<MeioPagamento, 'CARTAO'> | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'CARTAO'

export const ROTULO_MEIO_RELATORIO: Record<MeioRelatorioVendas, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  CARTAO: 'Cartão (tipo não informado)',
}

/** Período dos relatórios: o mês por padrão ou um intervalo (`AAAA-MM-DD`), pontas incluídas. */
export interface Periodo {
  de: string
  ate: string
}

export type Agrupamento = 'DIA' | 'SEMANA' | 'MES'

/** Subcategoria com o valor e a participação (%) no total do grupo; `percentual` nulo com total zero. */
export interface LinhaCategoria {
  codigo: string
  nome: string
  ativa: boolean
  valor: number
  percentual: number | null
}

export interface GrupoCategoria extends LinhaCategoria {
  subcategorias: LinhaCategoria[]
}

// US-REPORT-001

export interface FiltroFluxo extends Periodo {
  agrupamento: Agrupamento
  contaId?: number
  tipoConta?: TipoConta
}

export interface LinhaFluxo {
  inicio: string
  fim: string
  saldoInicial: number
  entradas: number
  saidas: number
  transferenciasEntrada: number
  transferenciasSaida: number
  saldoFinal: number
}

export interface FluxoCaixa {
  de: string
  ate: string
  agrupamento: Agrupamento
  contaId: number | null
  tipoConta: TipoConta | null
  contas: { contaId: number; nome: string; tipo: TipoConta }[]
  saldoInicial: number
  entradas: GrupoCategoria[]
  totalEntradas: number
  saidas: GrupoCategoria[]
  totalSaidas: number
  transferenciasEntrada: number
  transferenciasSaida: number
  saldoFinal: number
  periodos: LinhaFluxo[]
}

// US-REPORT-002

export interface ReceitasDespesas {
  de: string
  ate: string
  receitas: GrupoCategoria[]
  totalReceitas: number
  despesas: GrupoCategoria[]
  totalDespesas: number
  resultado: number
}

// US-REPORT-003

/** Com `data`, o modo "saldo na data"; senão, o período. */
export interface FiltroSaldos {
  de?: string
  ate?: string
  data?: string
}

/** No modo "saldo na data", só `saldoFinal` vem preenchido. */
export interface SaldoContaRelatorio {
  contaId: number
  nome: string
  tipo: TipoConta
  ativa: boolean
  saldoInicial: number | null
  entradas: number | null
  saidas: number | null
  transferenciasEntrada: number | null
  transferenciasSaida: number | null
  saldoFinal: number
  conciliadaAte: string | null
}

export type TotaisSaldos = Omit<SaldoContaRelatorio, 'contaId' | 'nome' | 'tipo' | 'ativa' | 'conciliadaAte'>

export interface SaldosPorConta {
  modo: 'PERIODO' | 'DATA'
  de: string | null
  ate: string
  grupos: { tipo: TipoConta; contas: SaldoContaRelatorio[]; totais: TotaisSaldos }[]
  totalDisponivel: TotaisSaldos
  cartaoAReceber: SaldoContaRelatorio | null
  totalComRecebiveis: number
}

// US-REPORT-004

export interface FiltroMensalidades extends Periodo {
  /** `AAAA-MM`. */
  competenciaDe: string
  competenciaAte: string
}

export interface SituacaoCompetencias {
  mes: string | null
  geradas: number
  pagas: number
  pendentes: number
  canceladas: number
  valorGerado: number
  valorPago: number
  valorPendente: number
  /** pagas / (geradas − canceladas), em %; nula sem competências válidas. */
  taxaPagamento: number | null
}

export interface Recebido {
  quantidade: number
  valor: number
}

export interface RecebimentoMensalidades {
  mes: string | null
  atrasadas: Recebido
  mesCorrente: Recebido
  antecipadas: Recebido
  total: Recebido
}

export interface DoadorComPendencias {
  doadorId: number
  nome: string
  pendentes: number
  valorPendente: number
  ultimoPagamento: string | null
}

export interface RelatorioMensalidades {
  competenciaDe: string
  competenciaAte: string
  porCompetencia: SituacaoCompetencias[]
  totalCompetencias: SituacaoCompetencias
  de: string
  ate: string
  recebimentosPorMes: RecebimentoMensalidades[]
  recebimentos: RecebimentoMensalidades
  doadoresComPendencias: DoadorComPendencias[]
}

// US-REPORT-006

export type FiltroVendasRelatorio = Periodo

export interface RelatorioVendas {
  de: string
  ate: string
  vendas: number
  receitaBruta: number
  canceladas: number
  valorCancelado: number
  receitaLiquida: number
  livros: number
  cantina: number
  porMeio: { meio: MeioRelatorioVendas; valor: number }[]
  porProduto: { produtoId: number; nome: string; tipo: 'LIVRO' | 'CANTINA'; quantidade: number; valor: number }[]
  /** `nome`: o do vendedor na venda. */
  porVendedor: {
    vendedorSubject: string
    nome: string
    vendas: number
    bruto: number
    canceladas: number
    cancelado: number
    liquido: number
  }[]
}

// US-REPORT-007

export interface FiltroEstoqueRelatorio extends Periodo {
  tipo?: 'LIVRO' | 'CANTINA'
  categoria?: string
  editoraId?: number
  somenteComMovimento?: boolean
}

/** fim = inicial + compra + doação + remessa − venda − devolução − baixa + ajuste. */
export interface LinhaEstoque {
  origem: 'PROPRIO' | 'CONSIGNADO' | 'TOTAL'
  remessaId: number | null
  remessaCodigo: string | null
  editoraId: number | null
  editoraNome: string | null
  inicial: number
  compra: number
  doacao: number
  remessa: number
  venda: number
  devolucao: number
  baixa: number
  ajuste: number
  fim: number
}

export interface ProdutoNoRelatorio {
  produtoId: number
  nome: string
  tipo: 'LIVRO' | 'CANTINA'
  categoria: string | null
  autor: string | null
  editoraNome: string | null
  ativo: boolean
  origens: LinhaEstoque[]
  total: LinhaEstoque
}

export type MotivoBaixaRelatorio = 'VENCIMENTO' | 'DANO' | 'EXTRAVIO'

export interface RelatorioEstoque {
  de: string
  ate: string
  tipo: 'LIVRO' | 'CANTINA' | null
  categoria: string | null
  editoraId: number | null
  somenteComMovimento: boolean
  produtos: ProdutoNoRelatorio[]
  total: LinhaEstoque
  baixasPorMotivo: { motivo: MotivoBaixaRelatorio; quantidade: number }[]
}

export type FiltroContagem = Omit<FiltroEstoqueRelatorio, 'de' | 'ate' | 'somenteComMovimento'>

export interface ItemContagem {
  produtoId: number
  nome: string
  tipo: 'LIVRO' | 'CANTINA'
  categoria: string | null
  autor: string | null
  editoraNome: string | null
  proprio: number
  consignado: number
  quantidade: number
}

export interface FolhaContagem {
  data: string
  tipo: 'LIVRO' | 'CANTINA' | null
  categoria: string | null
  editoraId: number | null
  itens: ItemContagem[]
}

// US-REPORT-009

export interface AcertoEditora {
  editoraId: number | null
  nome: string
  saldoInicial: number
  obrigacoesVendas: number
  obrigacoesBaixas: number
  estornos: number
  pagamentos: number
  /** Saldo passado formalmente ao mês seguinte no fechamento; não muda o valor devido. */
  transferido: number
  saldoFinal: number
}

export interface RelatorioEditoras {
  de: string
  ate: string
  editoras: AcertoEditora[]
  total: AcertoEditora
}

// US-REPORT-021

export type FormatoExportacao = 'PDF' | 'XLSX'

export type TipoExportacao =
  | 'fluxo-caixa'
  | 'receitas-despesas'
  | 'saldos'
  | 'mensalidades'
  | 'vendas'
  | 'estoque'
  | 'contagem-estoque'
  | 'editoras'
  | 'demonstrativo'
  | 'apuracao-editora'
  | 'conciliacao'
  | 'lancamentos'

/** Os mesmos filtros da tela, enviados como parâmetros da exportação. */
export type FiltrosExportacao = Record<string, string | number | boolean | undefined | null>
