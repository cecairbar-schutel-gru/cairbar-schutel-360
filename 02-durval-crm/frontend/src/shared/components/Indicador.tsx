import { Card, CardContent, Typography } from '@mui/material'

type Destaque = 'primary' | 'success' | 'warning' | 'error' | 'info'

/** Métrica em destaque nos painéis (wireframes 1–4); o destaque usa o tom escuro da cor (contraste AA). */
export function Indicador({
  rotulo,
  valor,
  destaque,
  detalhe,
}: {
  rotulo: string
  valor: string
  destaque?: Destaque
  detalhe?: string
}) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" component="p" color="text.secondary">
          {rotulo}
        </Typography>
        <Typography variant="h4" component="p" color={destaque ? `${destaque}.dark` : undefined}>
          {valor}
        </Typography>
        {detalhe && (
          <Typography variant="caption" component="p" color="text.secondary">
            {detalhe}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
