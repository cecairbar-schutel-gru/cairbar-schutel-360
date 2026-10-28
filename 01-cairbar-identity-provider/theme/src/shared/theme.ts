import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/700.css";
import { createTheme } from "@mui/material/styles";

/**
 * Tokens de marca extraídos do logotipo (ce_cairbar_logo.png).
 *
 * `brand.stripe` é o azul das faixas: só decorativo (contraste 1,97:1 sobre branco).
 * Texto, botões e links usam `primary`, a mesma matiz escurecida:
 *   primary.main #2C698B → 6,0:1 sobre branco e 5,6:1 sobre o fundo #F4F7FA (WCAG AA, RNF-009).
 *
 * TODO(seção 23.15): substituir pela paleta oficial e pelo logotipo vetorial quando existirem.
 * Sem variante do logotipo para fundo escuro, o modo escuro fica fora do MVP.
 */
export const brand = {
    stripe: "#7DC1E7",
    ink: "#111111"
} as const;

export const theme = createTheme({
    cssVariables: true,
    palette: {
        mode: "light",
        primary: { main: "#2C698B", dark: "#1B4055", light: brand.stripe, contrastText: "#FFFFFF" },
        secondary: { main: "#1B4055", contrastText: "#FFFFFF" },
        // Tons escolhidos para manter 4,5:1 também como texto (chips "outlined").
        success: { main: "#2E7D32" },
        warning: { main: "#8A5300" },
        error: { main: "#C62828" },
        info: { main: "#2C698B" },
        text: { primary: brand.ink, secondary: "#4A5560" },
        background: { default: "#F4F7FA", paper: "#FFFFFF" },
        divider: "rgba(17, 17, 17, 0.12)"
    },
    shape: { borderRadius: 10 },
    typography: {
        fontFamily: '"Fira Sans", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        h1: { fontSize: "2rem", fontWeight: 700 },
        h2: { fontSize: "1.625rem", fontWeight: 700 },
        h3: { fontSize: "1.375rem", fontWeight: 500 },
        h4: { fontSize: "1.25rem", fontWeight: 500 },
        h5: { fontSize: "1.125rem", fontWeight: 500 },
        h6: { fontSize: "1rem", fontWeight: 500 },
        button: { textTransform: "none", fontWeight: 500 }
    },
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true }
        },
        MuiCard: {
            defaultProps: { variant: "outlined" }
        },
        MuiTextField: {
            defaultProps: { fullWidth: true, margin: "normal" }
        },
        MuiLink: {
            defaultProps: { underline: "hover" }
        },
        MuiAppBar: {
            defaultProps: { color: "inherit", elevation: 0 },
            styleOverrides: {
                root: ({ theme }) => ({
                    borderBottom: `1px solid ${theme.palette.divider}`
                })
            }
        },
        // Foco sempre visível para navegação por teclado.
        MuiButtonBase: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&.Mui-focusVisible": {
                        outline: `3px solid ${theme.palette.primary.light}`,
                        outlineOffset: 2
                    }
                })
            }
        }
    }
});
