import { Chip } from '@mui/material'
import { ROTULO_STATUS, type StatusVenda } from '../types'

export function StatusVendaTag({ status }: { status: StatusVenda }) {
  return (
    <Chip
      size="small"
      color={status === 'CANCELADA' ? 'error' : 'success'}
      variant="outlined"
      label={ROTULO_STATUS[status]}
    />
  )
}
