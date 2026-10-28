import { Box, Skeleton } from '@mui/material'

/** Esqueleto de texto exibido enquanto os dados carregam. */
export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <Box role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === linhas - 1 ? '60%' : '100%'}
        />
      ))}
    </Box>
  )
}
