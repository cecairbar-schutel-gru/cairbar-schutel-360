import Box, { type BoxProps } from "@mui/material/Box";
import logoPng from "../brand/logo.png";
import logoWebp from "../brand/logo.webp";
import symbolPng from "../brand/symbol.png";
import { portal } from "../i18n/pt-BR";

/**
 * Logotipo horizontal (variant "full") ou só o símbolo das faixas (variant "symbol").
 * TODO(seção 23.15): trocar pelo SVG oficial e adicionar a variante para fundo escuro.
 */
export function BrandLogo(props: { variant?: "full" | "symbol"; height: number; sx?: BoxProps["sx"] }) {
    const { variant = "full", height, sx } = props;

    if (variant === "symbol") {
        return (
            <Box
                component="img"
                src={symbolPng}
                alt={portal.organizationName}
                sx={{ height, width: height, display: "block", ...sx }}
            />
        );
    }

    return (
        <Box component="picture" sx={{ display: "block", lineHeight: 0, ...sx }}>
            <source srcSet={logoWebp} type="image/webp" />
            <Box
                component="img"
                src={logoPng}
                alt={portal.organizationName}
                sx={{ height, width: "auto", maxWidth: "100%" }}
            />
        </Box>
    );
}
