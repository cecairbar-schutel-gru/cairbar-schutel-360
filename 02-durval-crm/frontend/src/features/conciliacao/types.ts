import type { NaturezaLancamento, OrigemLancamento } from '../financeiro/types'

export type StatusConciliacao = 'EM_ANDAMENTO' | 'CONCLUIDA'

/** Conta bancária ativa na tela inicial da conciliação (US-RECONCILIATION-001). */
export interface ContaParaConciliar {
  contaId: number
  contaNome: string
  banco: string | null
  agencia: string | null
  numeroConta: string | null
  dataCorte: string
  /** Data final da última sessão concluída; nula se nunca conciliada. */
  conciliadaAte: string | null
  /** Saldo do extrato da última sessão concluída. */
  saldoConciliado: number | null
  naoConciliados: number
  sessaoId: number | null
  sessaoDataFim: string | null
}

/** Lançamento da conta na sessão; `valor` é o movimento nela (+ entra, − sai). */
export interface ItemConciliacao {
  id: number
  data: string
  descricao: string
  origemTipo: OrigemLancamento
  origemId: number | null
  natureza: NaturezaLancamento
  valor: number
  estornaLancamentoId: number | null
  estornadoPorId: number | null
  corrigeLancamentoId: number | null
  /** Corrigido por estorno no Financeiro (contribuições e vendas: pelo cancelamento). */
  podeCorrigir: boolean
  marcado: boolean
  marcadoPor: string | null
  marcadoEm: string | null
  /** Registrado na tela da conciliação (US-RECONCILIATION-005). */
  adicionado: boolean
}

/** Sessão em andamento (lista para marcar) ou concluída (relatório, US-RECONCILIATION-010). */
export interface SessaoConciliacao {
  id: number
  contaId: number
  contaNome: string
  banco: string | null
  agencia: string | null
  numeroConta: string | null
  dataFim: string
  /** Em andamento: data final da última sessão concluída (a nova deve ser posterior). */
  dataFimAnterior: string | null
  saldoAbertura: number
  totalMarcado: number
  saldoConciliado: number
  saldoExtrato: number
  /** Saldo do extrato − (abertura + marcados). */
  diferenca: number
  status: StatusConciliacao
  iniciadaPor: string
  iniciadaEm: string
  concluidaPor: string | null
  concluidaEm: string | null
  /** Em andamento: os não conciliados até a data final; concluída: os conciliados. */
  lancamentos: ItemConciliacao[]
  /** Só na concluída: o que ficou sem marcar até a data final. */
  pendentes: ItemConciliacao[]
  /** Extrato do banco importado na sessão (nulo se não houver). */
  extrato: ExtratoDaSessao | null
}

export type FormatoExtrato = 'OFX' | 'CSV'

/** Movimento lido do arquivo do banco; `valor` com sinal (+ entra, − sai). */
export interface LinhaExtratoLida {
  data: string
  descricao: string
  valor: number
  /** FITID do OFX. */
  identificador: string | null
}

export interface LinhaDoExtrato extends LinhaExtratoLida {
  id: number
  /** Par confirmado: o lançamento marcado que corresponde à linha. */
  lancamentoId: number | null
  conferidaPor: string | null
  conferidaEm: string | null
  /** Em andamento e sem par: lançamento com o mesmo valor e data próxima (até 3 dias). */
  sugestaoId: number | null
}

export interface ExtratoDaSessao {
  arquivo: string
  formato: FormatoExtrato
  importadoPor: string
  importadoEm: string
  linhas: LinhaDoExtrato[]
}

export interface ImportacaoExtrato {
  arquivo: string
  formato: FormatoExtrato
  linhas: LinhaExtratoLida[]
}

export interface ParExtrato {
  linhaId: number
  lancamentoId: number
}

export interface ResumoConciliacao {
  id: number
  contaId: number
  contaNome: string
  dataFim: string
  saldoExtrato: number
  conciliados: number
  pendentes: number
  concluidaPor: string
  concluidaEm: string
}

export type TipoLancamentoAusente = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'

/** Movimento do banco que o sistema não tem (US-RECONCILIATION-005). */
export interface NovoLancamentoConciliacao {
  tipo: TipoLancamentoAusente
  data: string
  valor: number
  descricao: string
  /** Receita ou despesa: a subcategoria. */
  categoria?: string
  /** Transferência: a outra conta e se o dinheiro entra (padrão) ou sai da conta conciliada. */
  contraparteId?: number
  entrada?: boolean
  /** Linha do extrato importado que o lançamento explica. */
  linhaExtratoId?: number
  chaveIdempotencia: string
}
