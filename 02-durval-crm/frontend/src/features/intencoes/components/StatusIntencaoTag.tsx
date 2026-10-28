import { Chip } from '@mui/material'
import { COR_STATUS, ROTULO_STATUS } from '../rotulos'
import type { StatusIntencao } from '../types'

export function StatusIntencaoTag({ status }: { status: StatusIntencao }) {
  return <Chip size="small" variant="outlined" color={COR_STATUS[status]} label={ROTULO_STATUS[status]} />
}
