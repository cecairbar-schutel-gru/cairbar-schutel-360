import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GoogleIcon from "@mui/icons-material/Google";
import LoginIcon from "@mui/icons-material/Login";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FieldMessage } from "../components/FieldMessage";
import { PasswordField } from "../components/PasswordField";

/**
 * Login com usuário/e-mail e senha. Registro está desabilitado no realm; o link só
 * aparece se um dia for habilitado (registrationAllowed).
 * Provedores externos (Google) aparecem abaixo do formulário; no primeiro uso o realm só
 * vincula contas já cadastradas (realm/cecairbar.yml, realm_first_broker_login_flow).
 */
export default function Login(props: PageProps<Extract<KcContext, { pageId: "login.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { realm, url, usernameHidden, login, auth, registrationDisabled, messagesPerField, social } = kcContext;
    const { msg, msgStr } = i18n;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasCredentialError = messagesPerField.existsError("username", "password");
    const usernameLabel = !realm.loginWithEmailAllowed ? msg("username") : !realm.registrationEmailAsUsername ? msg("usernameOrEmail") : msg("email");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasCredentialError}
            headerNode={msg("portalLoginTitle")}
            displayInfo={realm.password && realm.registrationAllowed && !registrationDisabled}
            socialProvidersNode={
                realm.password &&
                social?.providers !== undefined &&
                social.providers.length > 0 && (
                    <Box id="kc-social-providers" sx={{ mt: 3 }}>
                        <Divider sx={{ mb: 3, color: "text.secondary" }}>{msg("portalOr")}</Divider>
                        <Stack spacing={1.5}>
                            {social.providers.map(p => (
                                <Button
                                    key={p.alias}
                                    id={`social-${p.alias}`}
                                    href={p.loginUrl}
                                    variant="outlined"
                                    size="large"
                                    fullWidth
                                    startIcon={p.providerId === "google" ? <GoogleIcon /> : <LoginIcon />}
                                >
                                    {msgStr("portalLoginWith", p.displayName)}
                                </Button>
                            ))}
                        </Stack>
                    </Box>
                )
            }
            infoNode={
                <Typography>
                    {msg("noAccount")} <Link href={url.registrationUrl}>{msg("doRegister")}</Link>
                </Typography>
            }
        >
            {realm.password && (
                <Box
                    component="form"
                    id="kc-form-login"
                    action={url.loginAction}
                    method="post"
                    onSubmit={() => {
                        setIsSubmitting(true);
                        return true;
                    }}
                >
                    {!usernameHidden && (
                        <TextField
                            id="username"
                            name="username"
                            label={usernameLabel}
                            defaultValue={login.username ?? ""}
                            autoComplete="username"
                            autoFocus
                            required
                            error={hasCredentialError}
                            slotProps={{ htmlInput: { "aria-invalid": hasCredentialError || undefined } }}
                        />
                    )}

                    <PasswordField
                        i18n={i18n}
                        id="password"
                        name="password"
                        label={msg("password")}
                        autoComplete="current-password"
                        autoFocus={usernameHidden}
                        required
                        error={hasCredentialError}
                        helperText={hasCredentialError ? <FieldMessage html={messagesPerField.getFirstError("username", "password")} /> : undefined}
                    />

                    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", mt: 1 }}>
                        {realm.rememberMe && !usernameHidden ? (
                            <FormControlLabel
                                control={<Checkbox name="rememberMe" defaultChecked={!!login.rememberMe} />}
                                label={msg("rememberMe")}
                            />
                        ) : (
                            <span />
                        )}
                        {realm.resetPasswordAllowed && <Link href={url.loginResetCredentialsUrl}>{msg("portalForgotPassword")}</Link>}
                    </Stack>

                    <input type="hidden" id="id-hidden-input" name="credentialId" value={auth.selectedCredential} />

                    <Button type="submit" name="login" id="kc-login" variant="contained" size="large" fullWidth loading={isSubmitting} sx={{ mt: 3 }}>
                        {msgStr("doLogIn")}
                    </Button>
                </Box>
            )}
        </Template>
    );
}
