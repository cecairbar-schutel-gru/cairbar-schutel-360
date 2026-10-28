import type { MotivoBaixa, StatusSolicitacao, TipoMovimento, TipoSolicitacao } from './types'

export const ROTULO_MOVIMENTO: Record<TipoMovimento, string> = {
  VENDA: 'Venda',
  CANCELAMENTO_VENDA: 'Cancelamento de venda',
  ENTRADA_COMPRA: 'Recebimento de compra',
  ENTRADA_DOACAO: 'Entrada por doação',
  ENTRADA_REMESSA: 'Entrada de remessa',
  DEVOLUCAO_EDITORA: 'Devolução à editora',
  BAIXA_VENCIMENTO: 'Baixa – Vencimento',
  BAIXA_DANO: 'Baixa – Dano',
  BAIXA_EXTRAVIO: 'Baixa – Extravio',
  AJUSTE: 'Ajuste',
  ESTORNO: 'Estorno',
}

export const ROTULO_MOTIVO_BAIXA: Record<MotivoBaixa, string> = {
  VENCIMENTO: 'Vencimento',
  DANO: 'Dano',
  EXTRAVIO: 'Extravio',
}

export const ROTULO_TIPO_SOLICITACAO: Record<TipoSolicitacao, string> = {
  BAIXA: 'Baixa',
  PRECO: 'Alteração de preço',
  INATIVACAO: 'Inativação',
}

export const ROTULO_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  CANCELADA: 'Cancelada',
}

/** Referência do movimento: venda, solicitação, entrada por doação, intenção de gasto ou remessa. */
export function rotuloReferencia(tipo: string | null, id: number | null): string {
  if (!tipo) return '—'
  const nomes: Record<string, string> = {
    VENDA: 'Venda',
    SOLICITACAO_ESTOQUE: 'Solicitação nº',
    ENTRADA_DOACAO: 'Doação nº',
    INTENCAO_GASTO: 'Intenção de gasto nº',
    REMESSA: 'Remessa',
    AJUSTE: 'Contagem física',
  }
  return id === null ? (nomes[tipo] ?? tipo) : `${nomes[tipo] ?? tipo} ${id}`
}

/** Unidades com sinal: +3 / −2. */
export function quantidadeComSinal(q: number): string {
  return q > 0 ? `+${q}` : `−${Math.abs(q)}`
}

export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}
