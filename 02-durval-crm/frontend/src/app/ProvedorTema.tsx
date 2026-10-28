import { CssBaseline, ThemeProvider } from '@mui/material'
import type { ReactNode } from 'react'
import { tema } from '../shared/theme/tema'

/** Tema DurvalCRM (MUI + locale pt-BR) e normalização de estilos. */
export function ProvedorTema({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={tema}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
