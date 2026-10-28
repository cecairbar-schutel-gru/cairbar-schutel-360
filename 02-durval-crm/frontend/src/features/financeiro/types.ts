import type { TipoCartao } from '../../shared/pagamento/regras'

export type TipoConta = 'CAIXA' | 'BANCO' | 'CARTAO_A_RECEBER'
export type TipoCategoria = 'RECEITA' | 'DESPESA'
export type NaturezaLancamento = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA' | 'LIQUIDACAO' | 'ESTORNO'
export type OrigemLancamento =
  | 'CONTRIBUICAO'
  | 'VENDA'
  | 'INTENCAO_GASTO'
  | 'PAGAMENTO_EDITORA'
  | 'CONTA_PAGAR'
  | 'MANUAL'
  | 'TRANSFERENCIA'
  | 'LIQUIDACAO_CARTAO'
  | 'IMPORTACAO'

/** Conta financeira (US-FINANCIAL-001); `saldo` e `temLancamentos` só vêm no cadastro. */
export interface ContaFinanceira {
  id: number
  /** Gerado do nome no cadastro. */
  codigo: string
  nome: string
  tipo: TipoConta
  ativa: boolean
  localizacao: string | null
  banco: string | null
  agencia: string | null
  numeroConta: string | null
  saldoInicial: number
  /** AAAA-MM-DD */
  dataCorte: string
  saldo: number | null
  temLancamentos: boolean | null
}

export interface DadosConta {
  tipo: TipoConta
  nome: string
  localizacao: string
  banco: string
  agencia: string
  numeroConta: string
  saldoInicial: number
  dataCorte: string
}

export interface SaldoConta {
  id: number
  codigo: string
  nome: string
  tipo: TipoConta
  ativa: boolean
  dataCorte: string
  /** Nulo quando a data pedida é anterior à data de corte. */
  saldo: number | null
}

/** US-FINANCIAL-002. */
export interface QuadroSaldos {
  data: string
  caixas: SaldoConta[]
  bancos: SaldoConta[]
  cartaoAReceber: SaldoConta | null
  subtotalCaixas: number
  subtotalBancos: number
  total: number
}

export interface Categoria {
  codigo: string
  nome: string
  tipo: TipoCategoria
  categoriaPai: string | null
  nomeCompleto: string
  ativa: boolean
  /** Fora das categorias com fluxo próprio (US-FINANCIAL-009). */
  permiteManual: boolean
}

export interface ResultadoLancamento {
  id: number
  avisos: string[]
}

export interface NovaTransferencia {
  contaOrigemId: number
  contaDestinoId: number
  valor: number
  data: string
  descricao: string
  chaveIdempotencia: string
}

export interface NovaLiquidacao {
  contaBancariaId: number
  data: string
  bruto: number
  taxa: number
  /** Opcional, só para conferência e relatório: o limite é o saldo total de Cartão a receber. */
  tipoCartao?: TipoCartao | null
  referencia: string
  chaveIdempotencia: string
}

/** Saldo atual de Cartão a receber dividido por tipo; "não informado" reúne o que não tem tipo. */
export interface SaldoCartaoAReceber {
  total: number
  credito: number
  debito: number
  naoInformado: number
}

export interface Anexo {
  nome: string
  tipo: string
  conteudoBase64: string
}

export interface NovoLancamentoManual {
  contaId: number
  data: string
  tipo: TipoCategoria
  categoria: string
  valor: number
  descricao: string
  anexo: Anexo | null
  chaveIdempotencia: string
}

export interface FiltroLancamentos {
  contaId?: number
  de?: string
  ate?: string
  natureza?: NaturezaLancamento
  categoria?: string
  origem?: OrigemLancamento
  texto?: string
  valor?: number
}

export interface ItemLancamento {
  id: number
  data: string
  descricao: string
  natureza: NaturezaLancamento
  origemTipo: OrigemLancamento
  origemId: number | null
  categorias: string[]
  contas: string[]
  /** Com conta filtrada, o movimento dela; sem conta, o valor principal (estornos com sinal invertido). */
  valor: number
  usuario: string
  estornaLancamentoId: number | null
  estornadoPorId: number | null
  corrigeLancamentoId: number | null
  /** Só com conta filtrada. */
  conciliado: boolean | null
  saldoApos: number | null
}

export interface PaginaLancamentos {
  conta: ContaFinanceira | null
  itens: ItemLancamento[]
  temMais: boolean
  saldoAnterior: number | null
  saldoFinal: number | null
}

export interface DetalheLancamento {
  id: number
  data: string
  descricao: string
  natureza: NaturezaLancamento
  origemTipo: OrigemLancamento
  origemId: number | null
  valor: number
  usuario: string
  registradoEm: string
  motivo: string | null
  referenciaExterna: string | null
  estornaLancamentoId: number | null
  estornadoPorId: number | null
  corrigeLancamentoId: number | null
  correcoes: number[]
  linhasConta: { contaId: number; contaNome: string; tipoConta: TipoConta | null; valor: number }[]
  linhasCategoria: { ordem: number; codigo: string; nome: string; tipo: TipoCategoria | null; valor: number }[]
  historico: { ordem: number; de: string; para: string; por: string; em: string; motivo: string }[]
  temAnexo: boolean
  conciliado: boolean
  podeEstornar: boolean
  podeReclassificar: boolean
}

/** Lançamento correto registrado junto com o estorno (US-FINANCIAL-010). */
export interface Correcao {
  data: string
  contaId: number | null
  contaDestinoId?: number | null
  tipo?: TipoCategoria
  categoria?: string
  valor: number
  taxa?: number
  descricao?: string
  referencia?: string
}

export interface ResultadoEstorno {
  estornoId: number
  correcaoId: number | null
  avisos: string[]
}

export interface Cancelamento {
  lancamentoId: number
  data: string
  registradoEm: string
  origemTipo: OrigemLancamento
  origemId: number | null
  descricao: string
  valor: number
  registradoPor: string
}

/** US-FINANCIAL-015 (wireframe 3). Contadores nulos: módulo ainda não entregue. */
export interface PainelTesoureiro {
  mes: string
  mensalidades: { previsto: number; recebido: number; pendente: number; pendenteAnterior: number }
  resumoDoMes: { receitas: number; despesas: number; taxasCartao: number }
  receitaLiquida: number
  saldos: QuadroSaldos
  intencoesPendentes: number | null
  conciliacoes: { contaId: number; contaNome: string; naoConciliados: number; ultimaConciliacao: string | null }[]
  /** Mês a fechar com o checklist (US-CLOSING-001); sem mês a fechar, o mês atual em andamento. */
  periodo: { mes: string; situacao: 'ABERTO' | 'REABERTO' | 'EM_ANDAMENTO'; itensConcluidos: number | null; itensTotal: number | null }
  cancelamentosRecentes: Cancelamento[]
}

/** Conta que recebe cada forma de pagamento das vendas e contribuições; `null` enquanto não definida. */
export interface ContasRecebimento {
  dinheiro: ContaFinanceira | null
  pix: ContaFinanceira | null
  cartao: ContaFinanceira
}
