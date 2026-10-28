/* eslint-disable @typescript-eslint/no-unused-vars */
import { i18nBuilder } from "keycloakify/login";
import type { ThemeName } from "../kc.gen";

/**
 * Textos do tema de login. O realm só oferece pt-BR (realm/cecairbar.yml); o inglês é o
 * idioma de fallback do Keycloakify. As chaves que já existem no Keycloak (invalidUserMessage...)
 * também são usadas nas mensagens geradas pelo servidor.
 *
 * @see https://docs.keycloakify.dev/features/i18n
 */
const { useI18n, ofTypeI18n } = i18nBuilder
    .withThemeName<ThemeName>()
    .withCustomTranslations({
        "pt-BR": {
            portalName: "Comunidade Cairbar",
            portalLoginTitle: "Bem Vindo à Comunidade Cairbar",
            portalForgotPassword: "Esqueci minha senha",
            portalShowPassword: "Mostrar senha",
            portalHidePassword: "Ocultar senha",
            portalBackToLogin: "Voltar para o login",
            portalResetTitle: "Redefinir senha",
            portalResetInstruction:
                "Informe seu usuário ou e-mail. Se houver uma conta correspondente, enviaremos as instruções para criar uma nova senha.",
            portalResetSubmit: "Enviar instruções",
            portalPasswordRules: "A senha deve ter:",
            portalPasswordRuleLength: "pelo menos {0} caracteres;",
            portalPasswordRuleNotUsername: "conteúdo diferente do seu usuário;",
            portalPasswordRuleNotEmail: "conteúdo diferente do seu e-mail;",
            portalPasswordRuleHistory: "não repetir as últimas {0} senhas.",
            portalSavePassword: "Salvar nova senha",
            portalVerifyEmailTitle: "Confirme seu e-mail",
            portalProfileTitle: "Complete seu cadastro",
            portalProfileReadOnlyHint: "Campos bloqueados são mantidos pela secretaria.",
            portalSave: "Salvar",
            portalTotpTitle: "Configurar verificação em duas etapas",
            portalOtpTitle: "Verificação em duas etapas",
            portalOtpDevice: "Dispositivo",
            portalErrorTitle: "Não foi possível continuar",
            portalInfoTitle: "Aviso",
            portalContinue: "Continuar",
            portalLogoutTitle: "Sair do portal",
            portalLogoutQuestion: "Deseja encerrar sua sessão?",
            portalRestartLogin: "Recomeçar o login",
            portalPageExpiredText: "A página ficou aberta por muito tempo e expirou.",
            portalRequired: "obrigatório",
            invalidUserMessage:
                "Usuário ou senha incorretos. Após várias tentativas seguidas, o acesso fica bloqueado por alguns minutos.",
            accountTemporarilyDisabledMessage:
                "Por segurança, o acesso foi bloqueado temporariamente. Aguarde alguns minutos e tente de novo ou use “Esqueci minha senha”.",
            accountDisabledMessage: "Este acesso está desativado. Procure a secretaria.",
            portalLoginWith: "Entrar com {0}",
            portalOr: "ou",
            federatedIdentityUnavailableMessage:
                "Não encontramos um cadastro na Comunidade Cairbar com o e-mail {0}. Procure a secretaria para cadastrar ou atualizar seu e-mail.",
            federatedIdentityConfirmReauthenticateMessage:
                "Para vincular sua conta {0}, entre uma vez com sua senha. Nos próximos acessos basta usar o {0}."
        },
        en: {
            portalName: "Cairbar Community",
            portalLoginTitle: "Welcome to Cairbar Community",
            portalForgotPassword: "Forgot my password",
            portalShowPassword: "Show password",
            portalHidePassword: "Hide password",
            portalBackToLogin: "Back to sign in",
            portalResetTitle: "Reset password",
            portalResetInstruction:
                "Enter your username or e-mail. If a matching account exists, we will send instructions to create a new password.",
            portalResetSubmit: "Send instructions",
            portalPasswordRules: "The password must:",
            portalPasswordRuleLength: "have at least {0} characters;",
            portalPasswordRuleNotUsername: "differ from your username;",
            portalPasswordRuleNotEmail: "differ from your e-mail;",
            portalPasswordRuleHistory: "not repeat your last {0} passwords.",
            portalSavePassword: "Save new password",
            portalVerifyEmailTitle: "Confirm your e-mail",
            portalProfileTitle: "Complete your profile",
            portalProfileReadOnlyHint: "Locked fields are maintained by the office.",
            portalSave: "Save",
            portalTotpTitle: "Set up two-step verification",
            portalOtpTitle: "Two-step verification",
            portalOtpDevice: "Device",
            portalErrorTitle: "Unable to continue",
            portalInfoTitle: "Notice",
            portalContinue: "Continue",
            portalLogoutTitle: "Sign out",
            portalLogoutQuestion: "Do you want to end your session?",
            portalRestartLogin: "Restart sign in",
            portalPageExpiredText: "This page was open for too long and has expired.",
            portalRequired: "required",
            invalidUserMessage:
                "Incorrect username or password. After several failed attempts, access is blocked for a few minutes.",
            accountTemporarilyDisabledMessage:
                "For security, access is temporarily blocked. Wait a few minutes and try again, or use “Forgot my password”.",
            accountDisabledMessage:
                "This account is disabled. Please contact the office.",
            portalLoginWith: "Sign in with {0}",
            portalOr: "or",
            federatedIdentityUnavailableMessage:
                "We could not find a Cairbar Community account with the e-mail {0}. Please contact the office.",
            federatedIdentityConfirmReauthenticateMessage:
                "To link your {0} account, sign in once with your password. Next time, just use {0}."
        }
    })
    .build();

type I18n = typeof ofTypeI18n;

export { useI18n, type I18n };
