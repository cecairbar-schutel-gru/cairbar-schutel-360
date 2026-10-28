import { Badge, Card, CardActionArea, CardContent, Typography } from '@mui/material'
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  rotulo: string
  icone: ComponentType
  /** Sem destino: o módulo ainda não foi entregue. */
  para?: string
  contador?: number | null
  ajuda?: string
}

/** Atalho do painel com contador de pendências (wireframe 3). */
export function AtalhoPainel({ rotulo, icone: Icone, para, contador, ajuda }: Props) {
  const conteudo = (
    <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
      <Badge badgeContent={contador ?? 0} color="error" max={99} aria-hidden={!contador}>
        <Icone />
      </Badge>
      <Typography component="span" variant="subtitle1">
        {rotulo}
      </Typography>
      {ajuda && (
        <Typography component="span" variant="caption" color="text.secondary">
          {ajuda}
        </Typography>
      )}
    </CardContent>
  )
  const nome = contador ? `${rotulo} (${contador} pendentes)` : rotulo
  return (
    <Card variant="outlined">
      {para ? (
        <CardActionArea component={Link} to={para} aria-label={nome} sx={{ height: '100%' }}>
          {conteudo}
        </CardActionArea>
      ) : (
        <CardActionArea disabled aria-label={ajuda ? `${nome}: ${ajuda}` : nome} sx={{ height: '100%' }}>
          {conteudo}
        </CardActionArea>
      )}
    </Card>
  )
}
