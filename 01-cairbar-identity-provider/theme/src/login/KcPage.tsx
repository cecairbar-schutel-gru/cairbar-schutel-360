import { Suspense, lazy } from "react";
import type { ClassKey } from "keycloakify/login";
import DefaultPage from "keycloakify/login/DefaultPage";
import type { KcContext } from "./KcContext";
import { useI18n } from "./i18n";
import Template from "./Template";

const UserProfileFormFields = lazy(() => import("keycloakify/login/UserProfileFormFields"));
const Login = lazy(() => import("./pages/Login"));
const LoginResetPassword = lazy(() => import("./pages/LoginResetPassword"));
const LoginUpdatePassword = lazy(() => import("./pages/LoginUpdatePassword"));
const LoginVerifyEmail = lazy(() => import("./pages/LoginVerifyEmail"));
const LoginUpdateProfile = lazy(() => import("./pages/LoginUpdateProfile"));
const LoginConfigTotp = lazy(() => import("./pages/LoginConfigTotp"));
const LoginOtp = lazy(() => import("./pages/LoginOtp"));
const Info = lazy(() => import("./pages/Info"));
const ErrorPage = lazy(() => import("./pages/Error"));
const LoginPageExpired = lazy(() => import("./pages/LoginPageExpired"));
const LogoutConfirm = lazy(() => import("./pages/LogoutConfirm"));

// Sem PatternFly: as páginas de fallback usam as classes kc* estilizadas em fallback.css.
const doUseDefaultCss = false;

export default function KcPage(props: { kcContext: KcContext }) {
    const { kcContext } = props;
    const { i18n } = useI18n({ kcContext });

    // Evita exibir os textos em inglês (fallback) enquanto as mensagens pt-BR carregam.
    if (i18n.isFetchingTranslations) {
        return null;
    }

    const common = { i18n, Template, doUseDefaultCss, classes };

    return (
        <Suspense>
            {(() => {
                switch (kcContext.pageId) {
                    case "login.ftl":
                        return <Login kcContext={kcContext} {...common} />;
                    case "login-reset-password.ftl":
                        return <LoginResetPassword kcContext={kcContext} {...common} />;
                    case "login-update-password.ftl":
                        return <LoginUpdatePassword kcContext={kcContext} {...common} />;
                    case "login-verify-email.ftl":
                        return <LoginVerifyEmail kcContext={kcContext} {...common} />;
                    case "login-update-profile.ftl":
                    case "update-email.ftl":
                        return <LoginUpdateProfile kcContext={kcContext} {...common} />;
                    case "login-config-totp.ftl":
                        return <LoginConfigTotp kcContext={kcContext} {...common} />;
                    case "login-otp.ftl":
                        return <LoginOtp kcContext={kcContext} {...common} />;
                    case "info.ftl":
                        return <Info kcContext={kcContext} {...common} />;
                    case "error.ftl":
                        return <ErrorPage kcContext={kcContext} {...common} />;
                    case "login-page-expired.ftl":
                        return <LoginPageExpired kcContext={kcContext} {...common} />;
                    case "logout-confirm.ftl":
                        return <LogoutConfirm kcContext={kcContext} {...common} />;
                    default:
                        return (
                            <DefaultPage
                                kcContext={kcContext}
                                {...common}
                                UserProfileFormFields={UserProfileFormFields}
                                doMakeUserConfirmPassword={false}
                            />
                        );
                }
            })()}
        </Suspense>
    );
}

const classes = {} satisfies { [key in ClassKey]?: string };
