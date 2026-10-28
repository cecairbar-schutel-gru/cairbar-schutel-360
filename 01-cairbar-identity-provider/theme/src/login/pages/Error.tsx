import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

/** Erro genérico: mostra só a mensagem do Keycloak, sem detalhes técnicos. */
export default function Error(props: PageProps<Extract<KcContext, { pageId: "error.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { message, client, skipLink } = kcContext;
    const { msg } = i18n;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={false}
            headerNode={msg("portalErrorTitle")}
        >
            <Alert severity="error" id="kc-error-message">
                <span dangerouslySetInnerHTML={{ __html: kcSanitize(message.summary) }} />
            </Alert>
            {!skipLink && client?.baseUrl && (
                <Button id="backToApplication" href={client.baseUrl} variant="outlined" size="large" fullWidth sx={{ mt: 3 }}>
                    {msg("backToApplication")}
                </Button>
            )}
        </Template>
    );
}
