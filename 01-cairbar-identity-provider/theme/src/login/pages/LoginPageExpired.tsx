import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

export default function LoginPageExpired(
    props: PageProps<Extract<KcContext, { pageId: "login-page-expired.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url } = kcContext;
    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            headerNode={msg("pageExpiredTitle")}
        >
            <Typography id="instruction1">{msg("portalPageExpiredText")}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3 }}>
                <Button id="loginContinueLink" href={url.loginAction} variant="contained" size="large" fullWidth>
                    {msg("portalContinue")}
                </Button>
                <Button id="loginRestartLink" href={url.loginRestartFlowUrl} variant="outlined" size="large" fullWidth>
                    {msg("portalRestartLogin")}
                </Button>
            </Stack>
        </Template>
    );
}
