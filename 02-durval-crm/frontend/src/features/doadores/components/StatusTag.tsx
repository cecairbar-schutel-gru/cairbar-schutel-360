import { Chip, type ChipProps } from '@mui/material'
import { ROTULO_STATUS } from '../rotulos'
import type { StatusDoador } from '../types'

const ESTILO: Record<StatusDoador, Pick<ChipProps, 'color' | 'variant'>> = {
  ATIVO: { color: 'success', variant: 'filled' },
  INATIVO: { color: 'default', variant: 'filled' },
  ANONIMIZADO: { color: 'default', variant: 'outlined' },
}

export function StatusTag({ status }: { status: StatusDoador }) {
  return <Chip size="small" label={ROTULO_STATUS[status]} {...ESTILO[status]} />
}
