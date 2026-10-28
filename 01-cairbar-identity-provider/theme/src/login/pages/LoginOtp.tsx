import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormLabel from "@mui/material/FormLabel";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import TextField from "@mui/material/TextField";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FieldMessage } from "../components/FieldMessage";
import { FormActions } from "../components/FormActions";

export default function LoginOtp(props: PageProps<Extract<KcContext, { pageId: "login-otp.ftl" }>, I18n>) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { otpLogin, url, messagesPerField } = kcContext;
    const { msg, msgStr } = i18n;
    const hasError = messagesPerField.existsError("totp");
    const credentials = otpLogin.userOtpCredentials;

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!hasError}
            headerNode={msg("portalOtpTitle")}
        >
            <Box component="form" id="kc-otp-login-form" action={url.loginAction} method="post">
                {credentials.length > 1 && (
                    <FormControl margin="normal">
                        <FormLabel id="otp-device-label">{msg("portalOtpDevice")}</FormLabel>
                        <RadioGroup
                            aria-labelledby="otp-device-label"
                            name="selectedCredentialId"
                            defaultValue={otpLogin.selectedCredentialId ?? credentials[0].id}
                        >
                            {credentials.map(credential => (
                                <FormControlLabel
                                    key={credential.id}
                                    value={credential.id}
                                    control={<Radio />}
                                    label={credential.userLabel}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                )}
                <TextField
                    id="otp"
                    name="otp"
                    label={msg("loginOtpOneTime")}
                    autoComplete="one-time-code"
                    autoFocus
                    required
                    error={hasError}
                    helperText={hasError ? <FieldMessage html={messagesPerField.get("totp")} /> : undefined}
                    slotProps={{ htmlInput: { inputMode: "numeric", "aria-invalid": hasError || undefined } }}
                />
                <FormActions i18n={i18n} submitLabel={msgStr("doLogIn")} submitName="login" />
            </Box>
        </Template>
    );
}
