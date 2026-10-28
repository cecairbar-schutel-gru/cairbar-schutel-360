import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FieldMessage } from "../components/FieldMessage";
import { FormActions } from "../components/FormActions";

/**
 * Pedido de redefinição de senha. O texto é neutro: não revela se o usuário/e-mail existe
 * (o Keycloak responde com a mesma mensagem nos dois casos).
 * TODO: o e-mail só é enviado depois que o SMTP do realm for configurado.
 */
export default function LoginResetPassword(
    props: PageProps<Extract<KcContext, { pageId: "login-reset-password.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, realm, auth, messagesPerField } = kcContext;
    const { msg } = i18n;
    const hasError = messagesPerField.existsError("username");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={msg("portalResetTitle")}
            displayInfo
            infoNode={<Link href={url.loginUrl}>{msg("portalBackToLogin")}</Link>}
        >
            <Box component="form" id="kc-reset-password-form" action={url.loginAction} method="post">
                <Typography color="text.secondary">{msg("portalResetInstruction")}</Typography>
                <TextField
                    id="username"
                    name="username"
                    label={!realm.loginWithEmailAllowed ? msg("username") : msg("usernameOrEmail")}
                    defaultValue={auth.attemptedUsername ?? ""}
                    autoComplete="username"
                    autoFocus
                    required
                    error={hasError}
                    helperText={hasError ? <FieldMessage html={messagesPerField.get("username")} /> : undefined}
                />
                <FormActions i18n={i18n} submitLabel={msg("portalResetSubmit")} />
            </Box>
        </Template>
    );
}
