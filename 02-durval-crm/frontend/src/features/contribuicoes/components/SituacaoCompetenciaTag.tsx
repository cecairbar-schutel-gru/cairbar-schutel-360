import { Chip, Stack } from '@mui/material'
import type { SituacaoCompetencia } from '../types'

const ROTULO: Record<SituacaoCompetencia, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
  FUTURA: 'Futura',
}
const COR: Record<SituacaoCompetencia, 'error' | 'success' | 'default' | 'info'> = {
  PENDENTE: 'error',
  PAGA: 'success',
  CANCELADA: 'default',
  FUTURA: 'info',
}

export function SituacaoCompetenciaTag({
  situacao,
  atrasada,
}: {
  situacao: SituacaoCompetencia
  atrasada: boolean
}) {
  return (
    <Stack direction="row" spacing={1}>
      <Chip
        size="small"
        color={COR[situacao]}
        variant={situacao === 'FUTURA' ? 'outlined' : 'filled'}
        label={ROTULO[situacao]}
      />
      {atrasada && (
        <Chip size="small" color="warning" variant="outlined" label="Em atraso" />
      )}
    </Stack>
  )
}
