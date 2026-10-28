import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

export default function Info(props: PageProps<Extract<KcContext, { pageId: "info.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { messageHeader, message, requiredActions, skipLink, pageRedirectUri, actionUri, client } = kcContext;
    const { msg, advancedMsgStr } = i18n;

    let html = message.summary?.trim() ?? "";
    if (requiredActions) {
        html += ` <b>${requiredActions.map(action => advancedMsgStr(`requiredAction.${action}`)).join(", ")}</b>`;
    }

    const next = skipLink
        ? undefined
        : pageRedirectUri
          ? { href: pageRedirectUri, label: msg("backToApplication") }
          : actionUri
            ? { href: actionUri, label: msg("portalContinue") }
            : client.baseUrl
              ? { href: client.baseUrl, label: msg("backToApplication") }
              : undefined;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={false}
            headerNode={messageHeader ? advancedMsgStr(messageHeader) : msg("portalInfoTitle")}
        >
            <Alert severity={message.type === "error" ? "error" : message.type === "warning" ? "warning" : "info"} id="kc-info-message">
                <span dangerouslySetInnerHTML={{ __html: kcSanitize(html) }} />
            </Alert>
            {next !== undefined && (
                <Button href={next.href} variant="contained" size="large" fullWidth sx={{ mt: 3 }}>
                    {next.label}
                </Button>
            )}
        </Template>
    );
}
