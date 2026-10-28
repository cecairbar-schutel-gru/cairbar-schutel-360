import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/500.css'
import '@fontsource/fira-sans/700.css'
import { createTheme } from '@mui/material/styles'
import { ptBR } from '@mui/material/locale'
import { ptBR as ptBRGraficos } from '@mui/x-charts/locales'
import { paleta } from './paleta'

/**
 * Tema único do DurvalCRM: o mesmo da Comunidade Cairbar (§2.3 de
 * durvalcrm-stack-tecnologica.md), mais os locales pt-BR do MUI e dos gráficos.
 */
export const tema = createTheme(
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
      // Tons escolhidos para manter 4,5:1 também como texto (chips "outlined").
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
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
      },
      MuiLink: {
        defaultProps: { underline: 'hover' },
      },
      MuiAppBar: {
        defaultProps: { color: 'inherit', elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiTab: {
        styleOverrides: { root: { textTransform: 'none' } },
      },
      // Item ativo do menu lateral, como no portal da Comunidade Cairbar.
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&.active': {
              backgroundColor: theme.palette.action.selected,
              color: theme.palette.primary.dark,
              fontWeight: 500,
              '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
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
  ptBRGraficos,
)
