/** Contratos do módulo Fechamento mensal (US-CLOSING-001, 007, 008, 009, 013 e 014); meses em `AAAA-MM`. */

export type StatusPeriodo = 'ABERTO' | 'FECHADO' | 'REABERTO'
/** Na lista de períodos, o mês atual aparece como em andamento (só leitura). */
export type SituacaoPeriodo = StatusPeriodo | 'EM_ANDAMENTO'

export type CodigoItem = 'CONCILIACAO' | 'INTENCOES' | 'ESTOQUE' | 'EDITORAS' | 'CARTAO'

export interface ItemCartao {
  saldoNoFimDoMes: number
  ultimaLiquidacao: string | null
  confirmadoPor: string | null
  confirmadoEm: string | null
}

export interface ItemChecklist {
  codigo: CodigoItem
  titulo: string
  concluido: boolean
  pendentes: number
  /** Papel que resolve a pendência: as solicitações de estoque só o Administrador. */
  responsavel: 'TESOUREIRO' | 'ADMINISTRADOR'
  detalhes: string[]
  cartao: ItemCartao | null
}

/**
 * Janela de fechamento (US-CLOSING-014): dias de cada mês (de 1 a 7 seguidos, até o dia 28) em que o mês
 * anterior pode ser fechado. `inicio` e `fim` são a janela em curso ou a próxima (`AAAA-MM-DD`).
 */
export interface SituacaoJanela {
  diaInicio: number
  diaFim: number
  aberta: boolean
  inicio: string
  fim: string
  alteradoPor: string | null
  alteradoEm: string | null
}

export interface Checklist {
  mes: string
  status: StatusPeriodo
  terminou: boolean
  itens: ItemChecklist[]
  concluidos: number
  /** Itens concluídos, mês terminado e hoje dentro da janela de fechamento. */
  podeFechar: boolean
  janela: SituacaoJanela
  reabertoPor: string | null
  reabertoEm: string | null
  justificativaReabertura: string | null
}

export interface PainelFechamento {
  mesAtual: string
  primeiroPeriodo: string | null
  /** O mês mais antigo aberto que já terminou (nulo se todos até o mês passado estão fechados). */
  mesAFechar: string | null
  checklist: Checklist | null
  ultimoFechado: string | null
}

export interface ResumoPeriodo {
  mes: string
  situacao: SituacaoPeriodo
  fechadoPor: string | null
  fechadoEm: string | null
  nota: string | null
  reabertoPor: string | null
  reabertoEm: string | null
  justificativa: string | null
  versoes: number
  aFechar: boolean
  podeReabrir: boolean
}

export interface Autor {
  subject: string
  nome: string | null
  em: string
}

export interface EventoPeriodo {
  mes: string
  evento: 'FECHAMENTO' | 'REABERTURA' | 'CARTAO_CONFIRMADO' | 'IMPORTACAO'
  autor: Autor
  texto: string | null
  versao: number | null
}

export interface VersaoDemonstrativo {
  versao: number
  autor: Autor
}

export interface HistoricoPeriodo {
  mes: string
  status: StatusPeriodo
  eventos: EventoPeriodo[]
  versoes: VersaoDemonstrativo[]
}

export interface PeriodoReaberto {
  mes: string
  reabertoPor: string
  reabertoEm: string
}

/** Comparação com o mês anterior (US-CLOSING-013); percentual nulo quando o anterior é zero. */
export interface Variacao {
  atual: number
  anterior: number
  diferenca: number
  percentual: number | null
  destaque: boolean
}

export interface LinhaComparada {
  codigo: string
  nome: string
  valores: Variacao
}

export interface GrupoComparado extends LinhaComparada {
  subcategorias: LinhaComparada[]
}

export interface SaldoContaMes {
  contaId: number
  nome: string
  tipo: 'CAIXA' | 'BANCO' | 'CARTAO_A_RECEBER'
  saldoInicial: number
  entradas: number
  saidas: number
  transferenciasEntrada: number
  transferenciasSaida: number
  saldoFinal: number
}

export interface SaldoEditoraMes {
  editoraId: number
  nome: string
  saldo: number
  transferido: boolean
}

export interface ResumoCompetencias {
  geradas: number
  pagas: number
  pendentes: number
  valorGerado: number
  valorPago: number
  valorPendente: number
}

export interface DemonstrativoMensal {
  mes: string
  /** PRELIMINAR: calculado agora; FECHADO: versão gravada no fechamento. */
  situacao: 'PRELIMINAR' | 'FECHADO'
  versao: number | null
  versaoVigente: boolean
  fechamento: Autor | null
  versoes: VersaoDemonstrativo[]
  mesAnterior: string
  anteriorFechado: boolean
  receitas: GrupoComparado[]
  totalReceitas: Variacao
  despesas: GrupoComparado[]
  totalDespesas: Variacao
  resultado: Variacao
  contas: SaldoContaMes[]
  editoras: SaldoEditoraMes[]
  totalEditoras: number
  mensalidades: ResumoCompetencias
  recebidoMensalidades: number
}
