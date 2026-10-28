import { Box, LinearProgress, Typography } from '@mui/material'
import { formatarMoeda } from '../../../shared/formatters/formatadores'
import { formatarPercentual, larguraDaBarra } from '../regras'

/** Valor em BRL; nulo vira "—" (coluna que não se aplica); negativo em vermelho. */
export function Dinheiro({ valor, negrito }: { valor: number | null; negrito?: boolean }) {
  if (valor === null) {
    return (
      <Typography component="span" variant="inherit" color="text.secondary">
        —
      </Typography>
    )
  }
  return (
    <Typography component="span" variant="inherit" color={valor < 0 ? 'error' : 'inherit'}
      sx={{ fontWeight: negrito ? 600 : undefined, whiteSpace: 'nowrap' }}>
      {formatarMoeda(valor)}
    </Typography>
  )
}

/** Barra de participação com o percentual ao lado (wireframe 12). */
export function BarraPercentual({ percentual, rotulo }: { percentual: number | null; rotulo?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
      <LinearProgress variant="determinate" value={larguraDaBarra(percentual)} sx={{ flexGrow: 1, height: 8, borderRadius: 1 }}
        aria-label={rotulo ? `${rotulo}: ${formatarPercentual(percentual)}` : undefined} aria-hidden={!rotulo} />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 44, textAlign: 'right' }}>
        {formatarPercentual(percentual)}
      </Typography>
    </Box>
  )
}
