import type { Meta, StoryObj } from "@storybook/react";
import { createKcPageStory } from "./KcPageStory";

/** Páginas de login com MUI e seus estados (erro, bloqueio, expirado...). Dados fictícios. */

const realm = {
    displayName: "CE Cairbar Schutel Guarulhos",
    registrationAllowed: false,
    rememberMe: false,
    resetPasswordAllowed: true
};

const { KcPageStory: LoginStory } = createKcPageStory({ pageId: "login.ftl" });

const meta = {
    title: "login/Páginas",
    component: LoginStory,
    parameters: { layout: "fullscreen" }
} satisfies Meta<typeof LoginStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Login: Story = { args: { kcContext: { realm } } };

const google = {
    alias: "google",
    providerId: "google",
    displayName: "Google",
    loginUrl: "#",
    iconClasses: ""
};

export const LoginComGoogle: Story = {
    args: { kcContext: { realm, social: { providers: [google] } } }
};

/** Primeiro login com Google: reautenticação com senha para vincular a conta. */
export const LoginVincularGoogle: Story = {
    args: {
        kcContext: {
            realm,
            login: { username: "maria.exemplo" },
            message: {
                type: "info",
                summary:
                    "Para vincular sua conta Google, entre uma vez com sua senha. Nos próximos acessos basta usar o Google."
            }
        }
    }
};

export const LoginCredenciaisInvalidas: Story = {
    args: {
        kcContext: {
            realm,
            login: { username: "maria.exemplo" },
            messagesPerField: {
                existsError: (...fields: string[]) =>
                    fields.includes("username") || fields.includes("password"),
                getFirstError: () =>
                    "Usuário ou senha incorretos. Após várias tentativas seguidas, o acesso fica bloqueado por alguns minutos."
            }
        }
    }
};

export const LoginBloqueado: Story = {
    args: {
        kcContext: {
            realm,
            message: {
                type: "error",
                summary:
                    "Por segurança, o acesso foi bloqueado temporariamente. Aguarde alguns minutos e tente de novo ou use “Esqueci minha senha”."
            }
        }
    }
};

const { KcPageStory: ResetStory } = createKcPageStory({
    pageId: "login-reset-password.ftl"
});
export const RedefinirSenha: Story = {
    render: () => <ResetStory kcContext={{ realm }} />
};

export const RedefinirSenhaEnviada: Story = {
    render: () => (
        <ResetStory
            kcContext={{
                realm,
                message: {
                    type: "success",
                    summary: "Você deverá receber um e-mail em breve com mais instruções."
                }
            }}
        />
    )
};

const { KcPageStory: UpdatePasswordStory } = createKcPageStory({
    pageId: "login-update-password.ftl"
});
export const NovaSenha: Story = {
    render: () => <UpdatePasswordStory kcContext={{ realm }} />
};
export const NovaSenhaPeloPortal: Story = {
    render: () => (
        <UpdatePasswordStory kcContext={{ realm, isAppInitiatedAction: true }} />
    )
};

const { KcPageStory: VerifyEmailStory } = createKcPageStory({
    pageId: "login-verify-email.ftl"
});
export const VerificarEmail: Story = {
    render: () => (
        <VerifyEmailStory kcContext={{ realm, user: { email: "maria@example.org" } }} />
    )
};

const { KcPageStory: UpdateProfileStory } = createKcPageStory({
    pageId: "login-update-profile.ftl"
});
export const CompletarCadastro: Story = {
    render: () => (
        <UpdateProfileStory
            kcContext={{
                realm,
                profile: {
                    attributesByName: {
                        personId: {
                            name: "personId",
                            displayName: "Identificador da pessoa",
                            readOnly: true,
                            required: false,
                            value: "PER-00000001",
                            validators: {},
                            annotations: {},
                            group: {
                                name: "identidade",
                                displayHeader: "Identidade",
                                annotations: {},
                                html5DataAnnotations: {}
                            }
                        },
                        preferredName: {
                            name: "preferredName",
                            displayName: "Nome de preferência",
                            readOnly: false,
                            required: false,
                            value: "",
                            validators: {},
                            annotations: {},
                            group: {
                                name: "identidade",
                                displayHeader: "Identidade",
                                annotations: {},
                                html5DataAnnotations: {}
                            }
                        }
                    }
                }
            }}
        />
    )
};

const { KcPageStory: TotpStory } = createKcPageStory({ pageId: "login-config-totp.ftl" });
export const Configurar2FA: Story = { render: () => <TotpStory kcContext={{ realm }} /> };

const { KcPageStory: OtpStory } = createKcPageStory({ pageId: "login-otp.ftl" });
export const Usar2FA: Story = { render: () => <OtpStory kcContext={{ realm }} /> };

const { KcPageStory: InfoStory } = createKcPageStory({ pageId: "info.ftl" });
export const Informacao: Story = {
    render: () => (
        <InfoStory
            kcContext={{
                realm,
                message: { type: "info", summary: "Sua conta foi atualizada." }
            }}
        />
    )
};

const { KcPageStory: ErrorStory } = createKcPageStory({ pageId: "error.ftl" });
export const Erro: Story = {
    render: () => (
        <ErrorStory
            kcContext={{
                realm,
                message: {
                    type: "error",
                    summary: "Não foi possível concluir a solicitação."
                }
            }}
        />
    )
};

export const GoogleSemCadastro: Story = {
    render: () => (
        <ErrorStory
            kcContext={{
                realm,
                message: {
                    type: "error",
                    summary:
                        "Não encontramos um cadastro na Comunidade Cairbar com o e-mail maria@gmail.com. Procure a secretaria para cadastrar ou atualizar seu e-mail."
                }
            }}
        />
    )
};

const { KcPageStory: ExpiredStory } = createKcPageStory({
    pageId: "login-page-expired.ftl"
});
export const PaginaExpirada: Story = {
    render: () => <ExpiredStory kcContext={{ realm }} />
};

const { KcPageStory: LogoutStory } = createKcPageStory({ pageId: "logout-confirm.ftl" });
export const ConfirmarSaida: Story = {
    render: () => <LogoutStory kcContext={{ realm }} />
};

const { KcPageStory: FallbackStory } = createKcPageStory({
    pageId: "login-oauth-grant.ftl"
});
export const PaginaGenericaFallback: Story = {
    render: () => <FallbackStory kcContext={{ realm }} />
};
