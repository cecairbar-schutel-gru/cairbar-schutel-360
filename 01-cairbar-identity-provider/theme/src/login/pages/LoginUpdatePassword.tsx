import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FieldMessage } from "../components/FieldMessage";
import { FormActions } from "../components/FormActions";
import { PasswordField } from "../components/PasswordField";

/**
 * Política de senha do realm, só para orientar o usuário (quem valida é o Keycloak).
 * Mantenha em sincronia com realm_settings.passwordPolicy em ansible/realm/cecairbar.yml:
 *   length(12) and notUsername and notEmail and passwordHistory(5)
 */
const passwordPolicy = { length: 12, notUsername: true, notEmail: true, history: 5 };

export default function LoginUpdatePassword(
    props: PageProps<Extract<KcContext, { pageId: "login-update-password.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, messagesPerField, isAppInitiatedAction } = kcContext;
    const { msg } = i18n;
    const hasError = messagesPerField.existsError("password", "password-confirm");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={msg("updatePasswordTitle")}
        >
            <Box component="form" id="kc-passwd-update-form" action={url.loginAction} method="post">
                <Alert severity="info" icon={false} sx={{ mb: 1 }}>
                    {msg("portalPasswordRules")}
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                        <li>{msg("portalPasswordRuleLength", String(passwordPolicy.length))}</li>
                        {passwordPolicy.notUsername && <li>{msg("portalPasswordRuleNotUsername")}</li>}
                        {passwordPolicy.notEmail && <li>{msg("portalPasswordRuleNotEmail")}</li>}
                        <li>{msg("portalPasswordRuleHistory", String(passwordPolicy.history))}</li>
                    </Box>
                </Alert>

                <PasswordField
                    i18n={i18n}
                    id="password-new"
                    name="password-new"
                    label={msg("passwordNew")}
                    autoComplete="new-password"
                    autoFocus
                    required
                    error={messagesPerField.existsError("password")}
                    helperText={
                        messagesPerField.existsError("password") ? (
                            <FieldMessage html={messagesPerField.get("password")} />
                        ) : undefined
                    }
                />
                <PasswordField
                    i18n={i18n}
                    id="password-confirm"
                    name="password-confirm"
                    label={msg("passwordConfirm")}
                    autoComplete="new-password"
                    required
                    error={messagesPerField.existsError("password-confirm")}
                    helperText={
                        messagesPerField.existsError("password-confirm") ? (
                            <FieldMessage html={messagesPerField.get("password-confirm")} />
                        ) : undefined
                    }
                />

                <FormControlLabel
                    control={<Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked />}
                    label={msg("logoutOtherSessions")}
                />

                <FormActions
                    i18n={i18n}
                    submitLabel={msg("portalSavePassword")}
                    isAppInitiatedAction={isAppInitiatedAction}
                />
            </Box>
        </Template>
    );
}
