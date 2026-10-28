import type { EventoPeriodo, SituacaoPeriodo } from './types'

export const ROTULO_SITUACAO: Record<SituacaoPeriodo, string> = {
  ABERTO: 'Aberto',
  FECHADO: 'Fechado',
  REABERTO: 'Reaberto',
  EM_ANDAMENTO: 'Em andamento',
}

export const COR_SITUACAO = {
  ABERTO: 'warning',
  FECHADO: 'success',
  REABERTO: 'error',
  EM_ANDAMENTO: 'info',
} as const

export const ROTULO_EVENTO: Record<EventoPeriodo['evento'], string> = {
  FECHAMENTO: 'Fechamento',
  REABERTURA: 'Reabertura',
  CARTAO_CONFIRMADO: 'Liquidações de cartão confirmadas',
  IMPORTACAO: 'Fechado pela importação do histórico',
}
