import { useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import { useInitialize } from "keycloakify/login/Template.useInitialize";
import type { TemplateProps } from "keycloakify/login/TemplateProps";
import { BrandLogo } from "../shared/components/BrandLogo";
import { ThemeRoot } from "../shared/ThemeRoot";
import { brand } from "../shared/theme";
import type { I18n } from "./i18n";
import type { KcContext } from "./KcContext";
import "./fallback.css";

const alertSeverity = { success: "success", warning: "warning", error: "error", info: "info" } as const;

/**
 * Moldura de todas as páginas de login: faixa de marca, cartão central com o logotipo,
 * título, mensagem global (Alert) e o conteúdo da página.
 *
 * Também é passada ao DefaultPage do Keycloakify (páginas sem versão própria), que usa
 * as classes kc* estilizadas em fallback.css (doUseDefaultCss=false: sem PatternFly).
 */
export default function Template(props: TemplateProps<KcContext, I18n>) {
    const {
        displayInfo = false,
        displayMessage = true,
        displayRequiredFields = false,
        headerNode,
        socialProvidersNode = null,
        infoNode = null,
        documentTitle,
        kcContext,
        i18n,
        doUseDefaultCss,
        children
    } = props;

    const { msg, msgStr } = i18n;
    const { realm, auth, url, message, isAppInitiatedAction } = kcContext;

    useEffect(() => {
        document.title = documentTitle ?? `${msgStr("portalName")} · ${realm.displayName || realm.name}`;
    }, []);

    const { isReadyToRender } = useInitialize({ kcContext, doUseDefaultCss });

    if (!isReadyToRender) {
        return null;
    }

    const showAttemptedUsername = auth !== undefined && auth.showUsername && !auth.showResetCredentials;
    const showMessage =
        displayMessage && message !== undefined && (message.type !== "warning" || !isAppInitiatedAction);

    return (
        <ThemeRoot>
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    // Faixas do logotipo como elemento decorativo no topo.
                    backgroundImage: `linear-gradient(${brand.stripe}, ${brand.stripe})`,
                    backgroundSize: "100% 6px",
                    backgroundRepeat: "no-repeat"
                }}
            >
                <Container component="main" maxWidth="sm" sx={{ flex: 1, py: { xs: 3, sm: 6 }, px: { xs: 2, sm: 3 } }}>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
                            <Stack sx={{ alignItems: "center", mb: 3 }}>
                                <BrandLogo height={48} />
                            </Stack>

                            {showAttemptedUsername ? (
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
                                    <Chip label={auth.attemptedUsername} variant="outlined" />
                                    <Link
                                        href={url.loginRestartFlowUrl}
                                        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                                    >
                                        <RestartAltIcon fontSize="small" aria-hidden />
                                        {msg("portalRestartLogin")}
                                    </Link>
                                </Stack>
                            ) : (
                                <Typography variant="h2" component="h1" id="kc-page-title" sx={{ mb: 2 }}>
                                    {headerNode}
                                </Typography>
                            )}

                            {displayRequiredFields && (
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                    * {msg("requiredFields")}
                                </Typography>
                            )}

                            {showMessage && (
                                <Alert severity={alertSeverity[message.type]} sx={{ mb: 2 }} role="alert">
                                    <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
                                </Alert>
                            )}

                            <Box className="cc-fallback">{children}</Box>

                            {auth !== undefined && auth.showTryAnotherWayLink && (
                                <form id="kc-select-try-another-way-form" action={url.loginAction} method="post">
                                    <input type="hidden" name="tryAnotherWay" value="on" />
                                    <Link component="button" type="submit" sx={{ mt: 2 }}>
                                        {msg("doTryAnotherWay")}
                                    </Link>
                                </form>
                            )}

                            {socialProvidersNode}

                            {displayInfo && <Box sx={{ mt: 3, textAlign: "center" }}>{infoNode}</Box>}
                        </CardContent>
                    </Card>
                </Container>
                <Box component="footer" sx={{ textAlign: "center", py: 2, color: "text.secondary" }}>
                    <Typography variant="caption">{realm.displayName || realm.name}</Typography>
                </Box>
            </Box>
        </ThemeRoot>
    );
}
