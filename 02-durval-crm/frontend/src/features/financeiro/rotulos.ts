import type { NaturezaLancamento, OrigemLancamento, TipoCategoria, TipoConta } from './types'

export const ROTULO_TIPO_CONTA: Record<TipoConta, string> = {
  CAIXA: 'Caixa',
  BANCO: 'Conta bancária',
  CARTAO_A_RECEBER: 'Cartão a receber',
}

export const ROTULO_TIPO_CATEGORIA: Record<TipoCategoria, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
}

export const ROTULO_NATUREZA: Record<NaturezaLancamento, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
  TRANSFERENCIA: 'Transferência',
  LIQUIDACAO: 'Liquidação',
  ESTORNO: 'Estorno',
}

export const ROTULO_ORIGEM: Record<OrigemLancamento, string> = {
  CONTRIBUICAO: 'Contribuição',
  VENDA: 'Venda',
  INTENCAO_GASTO: 'Intenção de gasto',
  PAGAMENTO_EDITORA: 'Pagamento a editora',
  CONTA_PAGAR: 'Conta a pagar',
  MANUAL: 'Manual',
  TRANSFERENCIA: 'Transferência',
  LIQUIDACAO_CARTAO: 'Liquidação de cartão',
  IMPORTACAO: 'Importação',
}

/** Link para o registro que gerou o lançamento, quando ele tem tela própria. */
export function linkDaOrigem(origem: OrigemLancamento, id: number | null): string | null {
  if (id === null) return null
  if (origem === 'CONTRIBUICAO') return `/contribuicoes/${id}`
  if (origem === 'VENDA') return `/vendas/${id}`
  if (origem === 'INTENCAO_GASTO') return `/intencoes-gasto/${id}`
  return null
}
