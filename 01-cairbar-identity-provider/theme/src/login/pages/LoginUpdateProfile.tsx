import { useState } from "react";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";
import { FormActions } from "../components/FormActions";
import { UserProfileFields } from "../components/UserProfileFields";

/**
 * "Complete seu cadastro" (login-update-profile.ftl) e troca de e-mail (update-email.ftl).
 * Os campos vêm dos metadados do User Profile; personId e demais atributos de administração
 * ficam só leitura — a garantia é do Keycloak (edit: [admin]), não desta tela.
 */
export default function LoginUpdateProfile(
    props: PageProps<Extract<KcContext, { pageId: "login-update-profile.ftl" | "update-email.ftl" }>, I18n>
) {
    const { kcContext, i18n, doUseDefaultCss, Template, classes } = props;
    const { url, messagesPerField, isAppInitiatedAction } = kcContext;
    const { msg, msgStr } = i18n;
    const [isFormSubmittable, setIsFormSubmittable] = useState(false);
    const isUpdateEmail = kcContext.pageId === "update-email.ftl";

    return (
        <Template
            kcContext={kcContext}
            i18n={i18n}
            doUseDefaultCss={doUseDefaultCss}
            classes={classes}
            displayRequiredFields
            displayMessage={messagesPerField.exists("global")}
            headerNode={isUpdateEmail ? msg("updateEmailTitle") : msg("portalProfileTitle")}
        >
            <Box
                component="form"
                id={isUpdateEmail ? "kc-update-email-form" : "kc-update-profile-form"}
                action={url.loginAction}
                method="post"
            >
                <UserProfileFields
                    kcContext={kcContext}
                    i18n={i18n}
                    onIsFormSubmittableValueChange={setIsFormSubmittable}
                />
                {isUpdateEmail && (
                    <FormControlLabel
                        control={<Checkbox id="logout-sessions" name="logout-sessions" value="on" defaultChecked />}
                        label={msg("logoutOtherSessions")}
                    />
                )}
                <FormActions
                    i18n={i18n}
                    submitLabel={msgStr("portalSave")}
                    isAppInitiatedAction={isAppInitiatedAction}
                    submitDisabled={!isFormSubmittable}
                />
            </Box>
        </Template>
    );
}
