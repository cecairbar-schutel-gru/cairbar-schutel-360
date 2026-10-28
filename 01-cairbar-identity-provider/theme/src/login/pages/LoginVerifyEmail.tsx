import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

/** TODO: depende do SMTP do realm para o e-mail de verificação chegar. */
export default function LoginVerifyEmail(
    props: PageProps<Extract<KcContext, { pageId: "login-verify-email.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, user } = kcContext;
    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayInfo
            headerNode={msg("portalVerifyEmailTitle")}
            infoNode={
                <Typography>
                    {msg("emailVerifyInstruction2")} <Link href={url.loginAction}>{msg("doClickHere")}</Link>{" "}
                    {msg("emailVerifyInstruction3")}
                </Typography>
            }
        >
            <Typography>{msg("emailVerifyInstruction1", user?.email ?? "")}</Typography>
        </Template>
    );
}
