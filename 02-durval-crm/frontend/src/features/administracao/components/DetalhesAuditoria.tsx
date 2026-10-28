import { Box, Typography } from '@mui/material'

function texto(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

/** Valores anteriores e novos, motivo e demais detalhes de um registro de auditoria. */
export function DetalhesAuditoria({ detalhes }: { detalhes: Record<string, unknown> }) {
  const { antes, depois, motivo, ...resto } = detalhes as {
    antes?: Record<string, unknown>
    depois?: Record<string, unknown>
    motivo?: string
  } & Record<string, unknown>
  const campos = [...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})])].filter(
    (c) => texto(antes?.[c]) !== texto(depois?.[c]),
  )
  if (campos.length === 0 && !motivo && Object.keys(resto).length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    )
  }
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1, typography: 'caption' }}>
      {campos.map((c) => (
        <Box key={c} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ fontWeight: 600 }}>
            {c}
          </Box>
          <Box component="dd" sx={{ m: 0 }}>
            {antes && c in antes ? `${texto(antes[c])} → ` : ''}
            {depois && c in depois ? texto(depois[c]) : antes ? '(removido)' : ''}
          </Box>
        </Box>
      ))}
      {Object.entries(resto).map(([c, v]) => (
        <Box key={c} sx={{ display: 'contents' }}>
          <Box component="dt" sx={{ fontWeight: 600 }}>
            {c}
          </Box>
          <Box component="dd" sx={{ m: 0 }}>
            {texto(v)}
          </Box>
        </Box>
      ))}
      {motivo && (
        <>
          <Box component="dt" sx={{ fontWeight: 600 }}>
            motivo
          </Box>
          <Box component="dd" sx={{ m: 0 }}>
            {motivo}
          </Box>
        </>
      )}
    </Box>
  )
}
