export type Recorrencia = 'UNICA' | 'MENSAL' | 'ANUAL'
export type SituacaoParcela = 'PAGA' | 'VENCIDA' | 'A_VENCER'
export type SituacaoContas = 'ATIVAS' | 'TODAS'

/** Conta a pagar: despesa única ou recorrente, no dia do primeiro vencimento. */
export interface ContaPagar {
  id: number
  descricao: string
  favorecido: string | null
  /** Código da subcategoria de despesa. */
  categoria: string
  valorPrevisto: number
  recorrencia: Recorrencia
  /** AAAA-MM-DD */
  primeiroVencimento: string
  /** Último dia com vencimento; nulo = sem fim (só nas recorrentes). */
  fimRecorrencia: string | null
  /** Conta financeira sugerida no pagamento. */
  contaFinanceiraId: number | null
  observacoes: string | null
  ativa: boolean
}

export type DadosContaPagar = Omit<ContaPagar, 'id' | 'ativa'>

export interface ResumoContaPagar {
  conta: ContaPagar
  categoriaNome: string | null
  /** Vencimento em aberto mais antigo (pode estar vencido); nulo se não há. */
  proximoVencimento: string | null
  /** Conta única com o vencimento pago: inativa, exibida como "Quitada". */
  quitada: boolean
}

export interface PagamentoContaPagar {
  id: number
  vencimento: string
  pagoEm: string
  valor: number
  contaId: number
  contaNome: string
  observacao: string | null
  lancamentoId: number | null
  registradoPor: string | null
  registradoEm: string
  /** Preenchido quando a despesa foi estornada no Financeiro: o vencimento voltou a ficar em aberto. */
  estornadoEm: string | null
}

export interface DetalheContaPagar {
  conta: ContaPagar
  categoriaNome: string | null
  /** Vencimentos sem pagamento até hoje e os próximos (no máximo 12). */
  emAberto: string[]
  pagamentos: PagamentoContaPagar[]
  /** Conta única com o vencimento pago: inativa, exibida como "Quitada"; o estorno do pagamento a reativa. */
  quitada: boolean
}

export interface Parcela {
  contaPagarId: number
  descricao: string
  favorecido: string | null
  categoria: string
  categoriaNome: string | null
  recorrencia: Recorrencia
  vencimento: string
  valorPrevisto: number
  contaFinanceiraId: number | null
  situacao: SituacaoParcela
  pagamento: PagamentoContaPagar | null
}

export interface ResumoContasPagar {
  vencidas: number
  valorVencidas: number
  aVencer: number
  valorAVencer: number
  diasAVencer: number
}

export interface NovoPagamentoConta {
  contaPagarId: number
  vencimento: string
  pagoEm: string
  valor: number
  contaId: number
  observacao: string
  chaveIdempotencia: string
}

export interface ResultadoPagamentoConta {
  id: number
  lancamentoId: number | null
  avisos: string[]
}
