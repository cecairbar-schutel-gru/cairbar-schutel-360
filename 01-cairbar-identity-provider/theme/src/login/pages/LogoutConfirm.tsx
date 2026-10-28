import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

export default function LogoutConfirm(props: PageProps<Extract<KcContext, { pageId: "logout-confirm.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, client, logoutConfirm } = kcContext;
    const { msg, msgStr } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            headerNode={msg("portalLogoutTitle")}
            displayInfo={!logoutConfirm.skipLink && !!client.baseUrl}
            infoNode={<Link href={client.baseUrl}>{msg("backToApplication")}</Link>}
        >
            <Typography>{msg("portalLogoutQuestion")}</Typography>
            <Box component="form" action={url.logoutConfirmAction} method="POST">
                <input type="hidden" name="session_code" value={logoutConfirm.code} />
                <Button
                    type="submit"
                    name="confirmLogout"
                    id="kc-logout"
                    variant="contained"
                    size="large"
                    fullWidth
                    sx={{ mt: 3 }}
                >
                    {msgStr("doLogout")}
                </Button>
            </Box>
        </Template>
    );
}
