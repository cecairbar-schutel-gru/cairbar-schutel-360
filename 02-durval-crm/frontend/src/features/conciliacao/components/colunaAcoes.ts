import type { SxProps, Theme } from '@mui/material'

/**
 * Coluna "Ações" presa à direita na rolagem horizontal, para não sumir em telas estreitas
 * (P20 da simulação de 27/10/2026). O fundo cobre o que passa por baixo.
 */
export const COLUNA_ACOES_FIXA: SxProps<Theme> = {
  position: 'sticky',
  right: 0,
  bgcolor: 'background.paper',
  boxShadow: (t) => `inset 1px 0 0 ${t.palette.divider}`,
}
