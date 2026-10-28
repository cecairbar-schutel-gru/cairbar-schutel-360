import { Chip, Typography } from '@mui/material'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { ROTULO_NATUREZA } from '../rotulos'
import type { NaturezaLancamento } from '../types'

const COR_NATUREZA = {
  RECEITA: 'success',
  DESPESA: 'warning',
  TRANSFERENCIA: 'info',
  LIQUIDACAO: 'primary',
  ESTORNO: 'default',
} as const

export function NaturezaTag({ natureza }: { natureza: NaturezaLancamento }) {
  return <Chip size="small" variant="outlined" color={COR_NATUREZA[natureza]} label={ROTULO_NATUREZA[natureza]} />
}

export function ContaAtivaTag({ ativa }: { ativa: boolean }) {
  return <Chip size="small" variant="outlined" color={ativa ? 'success' : 'default'} label={ativa ? 'Ativa' : 'Inativa'} />
}

/** Valor em BRL; negativo em vermelho (saldo bancário negativo, saídas). */
export function Valor({ valor, negrito }: { valor: number | null; negrito?: boolean }) {
  if (valor === null) {
    return (
      <Typography component="span" variant="inherit" color="text.secondary">
        Antes da data de corte
      </Typography>
    )
  }
  return (
    <Typography
      component="span"
      variant="inherit"
      color={valor < 0 ? 'error' : 'inherit'}
      sx={{ fontWeight: negrito ? 600 : undefined, whiteSpace: 'nowrap' }}
    >
      {formatarMoeda(valor)}
    </Typography>
  )
}
