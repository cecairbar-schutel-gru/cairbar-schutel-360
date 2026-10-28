import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/500.css'
import '@fontsource/fira-sans/700.css'
import { createTheme, responsiveFontSizes } from '@mui/material/styles'
import { ptBR } from '@mui/material/locale'

/**
 * Identidade visual da Comunidade Cairbar, a mesma de
 * 01-cairbar-identity-provider/theme/src/shared/theme.ts e
 * 02-durval-crm/frontend/src/shared/theme/paleta.ts. Ao mudar o tema de um lado, mude dos outros.
 *
 * `faixa` é o azul das faixas do logotipo: só decorativo (≈ 2:1 sobre branco).
 * Texto, botões e links usam `primaria`: 6,0:1 sobre branco (WCAG AA).
 */
export const paleta = {
  faixa: '#7DC1E7',
  primaria: '#2C698B',
  primariaEscura: '#1B4055',
  grafite: '#111111',
  textoSecundario: '#4A5560',
  fundo: '#F4F7FA',
  superficie: '#FFFFFF',
  divisor: 'rgba(17, 17, 17, 0.12)',
  sucesso: '#2E7D32',
  alerta: '#8A5300',
  erro: '#C62828',
} as const

export const tema = responsiveFontSizes(
  createTheme(
    {
      cssVariables: true,
      palette: {
        mode: 'light',
        primary: {
          main: paleta.primaria,
          dark: paleta.primariaEscura,
          light: paleta.faixa,
          contrastText: paleta.superficie,
        },
        secondary: { main: paleta.primariaEscura, contrastText: paleta.superficie },
        success: { main: paleta.sucesso },
        warning: { main: paleta.alerta },
        error: { main: paleta.erro },
        info: { main: paleta.primaria },
        text: { primary: paleta.grafite, secondary: paleta.textoSecundario },
        background: { default: paleta.fundo, paper: paleta.superficie },
        divider: paleta.divisor,
      },
      shape: { borderRadius: 10 },
      typography: {
        fontFamily:
          '"Fira Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        h1: { fontSize: '2rem', fontWeight: 700 },
        h2: { fontSize: '1.625rem', fontWeight: 700 },
        h3: { fontSize: '1.375rem', fontWeight: 500 },
        h4: { fontSize: '1.25rem', fontWeight: 500 },
        h5: { fontSize: '1.125rem', fontWeight: 500 },
        h6: { fontSize: '1rem', fontWeight: 500 },
        button: { textTransform: 'none', fontWeight: 500 },
      },
      components: {
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiCard: { defaultProps: { variant: 'outlined' } },
        MuiLink: { defaultProps: { underline: 'hover' } },
        MuiAppBar: {
          defaultProps: { color: 'inherit', elevation: 0 },
          styleOverrides: {
            root: ({ theme }) => ({ borderBottom: `1px solid ${theme.palette.divider}` }),
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: ({ theme }) => ({
              '&.active': {
                backgroundColor: theme.palette.action.selected,
                color: theme.palette.primary.dark,
                fontWeight: 500,
              },
            }),
          },
        },
        // Foco sempre visível para navegação por teclado.
        MuiButtonBase: {
          styleOverrides: {
            root: ({ theme }) => ({
              '&.Mui-focusVisible': {
                outline: `3px solid ${theme.palette.primary.light}`,
                outlineOffset: 2,
              },
            }),
          },
        },
      },
    },
    ptBR,
  ),
)
