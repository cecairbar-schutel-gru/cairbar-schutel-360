import { useEffect, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";
import faviconUrl from "./brand/favicon-32.png";

/** Tema MUI + reset de CSS + favicon com o símbolo das faixas. */
export function ThemeRoot(props: { children: ReactNode }) {
    useEffect(() => {
        document.documentElement.lang = "pt-BR";
        document.querySelectorAll("link[rel~='icon']").forEach(link => link.remove());
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        link.href = faviconUrl;
        document.head.appendChild(link);
    }, []);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {props.children}
        </ThemeProvider>
    );
}
