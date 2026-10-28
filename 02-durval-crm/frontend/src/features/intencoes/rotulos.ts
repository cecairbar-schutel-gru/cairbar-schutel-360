import type { MeioPagamentoGasto, StatusIntencao } from './types'

export const ROTULO_STATUS: Record<StatusIntencao, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  AGUARDANDO_RECEBIMENTO: 'Aguardando recebimento',
  DIVERGENTE: 'Divergente',
  RECEBIDA: 'Recebida',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
}

export const COR_STATUS = {
  PENDENTE: 'warning',
  APROVADA: 'success',
  AGUARDANDO_RECEBIMENTO: 'info',
  DIVERGENTE: 'error',
  RECEBIDA: 'success',
  REJEITADA: 'error',
  CANCELADA: 'default',
} as const satisfies Record<StatusIntencao, string>

export const ROTULO_MEIO: Record<MeioPagamentoGasto, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  TRANSFERENCIA: 'Transferência',
  BOLETO: 'Boleto',
}
