import type { ChipProps } from '@mui/material'
import type { MeioPagamentoEditora, OrigemObrigacao, SituacaoPedido, SituacaoRemessa, StatusObrigacao } from './types'

export const ROTULO_SITUACAO_PEDIDO: Record<SituacaoPedido, string> = {
  ABERTO: 'Aguardando entrega',
  RECEBIDO: 'Recebido',
  CANCELADO: 'Cancelado',
}

export const COR_SITUACAO_PEDIDO: Record<SituacaoPedido, ChipProps['color']> = {
  ABERTO: 'warning',
  RECEBIDO: 'success',
  CANCELADO: 'error',
}

export const ROTULO_SITUACAO_REMESSA: Record<SituacaoRemessa, string> = {
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
}

export const COR_SITUACAO_REMESSA: Record<SituacaoRemessa, ChipProps['color']> = {
  ABERTA: 'success',
  ENCERRADA: 'default',
  CANCELADA: 'error',
}

export const ROTULO_STATUS_OBRIGACAO: Record<StatusObrigacao, string> = {
  ABERTA: 'Em aberto',
  PARCIALMENTE_PAGA: 'Parcialmente paga',
  PAGA: 'Paga',
  ESTORNADA: 'Estornada',
}

export const COR_STATUS_OBRIGACAO: Record<StatusObrigacao, ChipProps['color']> = {
  ABERTA: 'warning',
  PARCIALMENTE_PAGA: 'info',
  PAGA: 'success',
  ESTORNADA: 'default',
}

export const ROTULO_MEIO: Record<MeioPagamentoEditora, string> = {
  PIX: 'PIX',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
}

/** "Venda nº 12" ou "Baixa nº 3". */
export function origemObrigacao(origem: OrigemObrigacao, numero: number | null): string {
  return `${origem === 'VENDA' ? 'Venda' : 'Baixa'} nº ${numero ?? '—'}`
}
