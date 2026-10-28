import type { Recorrencia, SituacaoParcela } from './types'

export const ROTULO_RECORRENCIA: Record<Recorrencia, string> = {
  UNICA: 'Única',
  MENSAL: 'Mensal',
  ANUAL: 'Anual',
}

export const ROTULO_SITUACAO_PARCELA: Record<SituacaoParcela, string> = {
  PAGA: 'Paga',
  VENCIDA: 'Vencida',
  A_VENCER: 'A vencer',
}

export const COR_SITUACAO_PARCELA: Record<SituacaoParcela, 'success' | 'error' | 'default'> = {
  PAGA: 'success',
  VENCIDA: 'error',
  A_VENCER: 'default',
}
