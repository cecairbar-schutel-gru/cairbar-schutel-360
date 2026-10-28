import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Step from "@mui/material/Step";
import StepContent from "@mui/material/StepContent";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FieldMessage } from "../components/FieldMessage";
import { FormActions } from "../components/FormActions";

/** Configuração de autenticador (TOTP). Preparado para o MFA de administradores (seção 15.1). */
export default function LoginConfigTotp(
    props: PageProps<Extract<KcContext, { pageId: "login-config-totp.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, isAppInitiatedAction, totp, mode, messagesPerField } = kcContext;
    const { msg, msgStr, advancedMsgStr } = i18n;
    const isManual = mode === "manual";
    const totpError = messagesPerField.existsError("totp");
    const labelError = messagesPerField.existsError("userLabel");

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayMessage={!messagesPerField.existsError("totp", "userLabel")}
            headerNode={msg("portalTotpTitle")}
        >
            <Stepper orientation="vertical" nonLinear activeStep={-1} sx={{ mb: 2 }}>
                <Step active>
                    <StepLabel>{msg("loginTotpStep1")}</StepLabel>
                    <StepContent>
                        <List dense disablePadding>
                            {totp.supportedApplications.map(app => (
                                <ListItem key={app} disableGutters>
                                    <ListItemText primary={advancedMsgStr(app)} />
                                </ListItem>
                            ))}
                        </List>
                    </StepContent>
                </Step>
                <Step active>
                    <StepLabel>{isManual ? msg("loginTotpManualStep2") : msg("loginTotpStep2")}</StepLabel>
                    <StepContent>
                        {isManual ? (
                            <>
                                <Paper variant="outlined" sx={{ p: 1.5, fontFamily: "monospace", wordBreak: "break-all" }}>
                                    {totp.totpSecretEncoded}
                                </Paper>
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                    {msg("loginTotpManualStep3")} {msg("loginTotpType")}:{" "}
                                    {msg(`loginTotp.${totp.policy.type}`)};{" "}
                                    {msg("loginTotpAlgorithm")}: {totp.policy.getAlgorithmKey()}; {msg("loginTotpDigits")}:{" "}
                                    {totp.policy.digits};{" "}
                                    {totp.policy.type === "totp"
                                        ? `${msgStr("loginTotpInterval")}: ${totp.policy.period}`
                                        : `${msgStr("loginTotpCounter")}: ${totp.policy.initialCounter}`}
                                </Typography>
                                <Link href={totp.qrUrl}>{msg("loginTotpScanBarcode")}</Link>
                            </>
                        ) : (
                            <>
                                <Box
                                    component="img"
                                    id="kc-totp-secret-qr-code"
                                    src={`data:image/png;base64, ${totp.totpSecretQrCode}`}
                                    alt={msgStr("loginTotpStep2")}
                                    sx={{ width: 200, height: 200, display: "block" }}
                                />
                                <Link href={totp.manualUrl}>{msg("loginTotpUnableToScan")}</Link>
                            </>
                        )}
                    </StepContent>
                </Step>
                <Step active>
                    <StepLabel>{msg("loginTotpStep3")}</StepLabel>
                    <StepContent>
                        <Typography variant="body2">{msg("loginTotpStep3DeviceName")}</Typography>
                    </StepContent>
                </Step>
            </Stepper>

            <Box component="form" id="kc-totp-settings-form" action={url.loginAction} method="post">
                <TextField
                    id="totp"
                    name="totp"
                    label={msg("authenticatorCode")}
                    autoComplete="one-time-code"
                    required
                    error={totpError}
                    helperText={totpError ? <FieldMessage html={messagesPerField.get("totp")} /> : undefined}
                    slotProps={{ htmlInput: { inputMode: "numeric", "aria-invalid": totpError || undefined } }}
                />
                <input type="hidden" id="totpSecret" name="totpSecret" value={totp.totpSecret} />
                {mode && <input type="hidden" id="mode" name="mode" value={mode} />}
                <TextField
                    id="userLabel"
                    name="userLabel"
                    label={msg("loginTotpDeviceName")}
                    autoComplete="off"
                    required={totp.otpCredentials.length >= 1}
                    error={labelError}
                    helperText={labelError ? <FieldMessage html={messagesPerField.get("userLabel")} /> : undefined}
                />
                <FormControlLabel
                    control={<Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked />}
                    label={msg("logoutOtherSessions")}
                />
                <FormActions
                    i18n={i18n}
                    submitLabel={msgStr("portalSave")}
                    submitName="login"
                    isAppInitiatedAction={isAppInitiatedAction}
                />
            </Box>
        </Template>
    );
}
