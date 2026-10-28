import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

/**
 * Diálogos em tela cheia no celular (abaixo de `sm`), como recomenda o Material Design; da largura
 * `sm` para cima voltam a ser modais centralizados.
 */
export function useTelaCheia(): boolean {
  const theme = useTheme()
  return !useMediaQuery(theme.breakpoints.up('sm'))
}
