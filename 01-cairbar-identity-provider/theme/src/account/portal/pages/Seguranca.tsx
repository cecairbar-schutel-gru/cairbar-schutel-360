import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import PasswordIcon from "@mui/icons-material/Password";
import PhonelinkLockOutlinedIcon from "@mui/icons-material/PhonelinkLockOutlined";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { useAccountApi, type CredentialContainer } from "../api";
import { LoadError, LoadingCards } from "../Feedback";
import { formatMillis } from "../format";
import { useAsync } from "../useAsync";

/** Nomes amigáveis dos tipos de credencial do Keycloak; tipos novos usam o próprio tipo. */
const credentialText: Record<string, { title: string; help: string; icon: JSX.Element }> = {
    password: {
        title: "Senha",
        help: "Usada para entrar no portal e nos sistemas da organização.",
        icon: <PasswordIcon />
    },
    otp: {
        title: "Verificação em duas etapas",
        help: "Código de uso único gerado por um aplicativo autenticador no celular.",
        icon: <PhonelinkLockOutlinedIcon />
    },
    webauthn: {
        title: "Chave de segurança",
        help: "Dispositivo físico ou biometria como segundo fator.",
        icon: <KeyOutlinedIcon />
    },
    "webauthn-passwordless": {
        title: "Chave de acesso (passkey)",
        help: "Entrar sem senha usando o dispositivo.",
        icon: <KeyOutlinedIcon />
    },
    "recovery-authn-codes": {
        title: "Códigos de recuperação",
        help: "Códigos para entrar se você perder o segundo fator.",
        icon: <KeyOutlinedIcon />
    }
};

const actionLabel: Record<string, string> = {
    UPDATE_PASSWORD: "Alterar senha",
    CONFIGURE_TOTP: "Configurar",
    "webauthn-register": "Cadastrar",
    "webauthn-register-passwordless": "Cadastrar",
    CONFIGURE_RECOVERY_AUTHN_CODES: "Gerar códigos"
};

/**
 * Senha e segundo fator. As alterações são ações de aplicação do Keycloak (kc_action): o
 * usuário vai para a tela de login do tema, confirma a identidade e volta para cá.
 */
export default function Seguranca() {
    const api = useAccountApi();
    const { data, error, loading, reload } = useAsync(signal => api.getCredentials(signal));

    return (
        <>
            <PageHeader title="Segurança" description="Gerencie sua senha e a verificação em duas etapas." />
            {error !== undefined ? (
                <LoadError onRetry={reload} />
            ) : loading && data === undefined ? (
                <LoadingCards count={2} />
            ) : (
                <Stack spacing={2}>
                    {(data ?? []).map(container => (
                        <CredentialCard key={container.type} container={container} onAction={api.requestAction} />
                    ))}
                </Stack>
            )}
        </>
    );
}

function CredentialCard(props: { container: CredentialContainer; onAction: (action: string) => Promise<void> }) {
    const { container, onAction } = props;
    const text = credentialText[container.type] ?? { title: container.type, help: "", icon: <KeyOutlinedIcon /> };
    const credentials = container.userCredentialMetadatas ?? [];
    const isPassword = container.type === "password";
    const headingId = `credencial-${container.type}`;

    return (
        <Card component="section" aria-labelledby={headingId}>
            <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
                    <Stack direction="row" spacing={2}>
                        <Typography color="primary" sx={{ mt: 0.5 }} aria-hidden>
                            {text.icon}
                        </Typography>
                        <div>
                            <Typography variant="h5" component="h2" id={headingId}>
                                {text.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {text.help}
                            </Typography>
                        </div>
                    </Stack>
                    {container.createAction && (!isPassword || credentials.length === 0) && (
                        <Button
                            variant="contained"
                            onClick={() => void onAction(container.createAction)}
                            sx={{ alignSelf: { xs: "stretch", sm: "flex-start" }, flexShrink: 0 }}
                        >
                            {actionLabel[container.createAction] ?? "Configurar"}
                        </Button>
                    )}
                </Stack>

                <Divider sx={{ my: 2 }} />

                {credentials.length === 0 ? (
                    <EmptyState title="Não configurado" />
                ) : (
                    <List disablePadding>
                        {credentials.map(({ credential }) => (
                            <ListItem
                                key={credential.id}
                                disableGutters
                                secondaryAction={
                                    <Stack direction="row" spacing={1}>
                                        {container.updateAction && (
                                            <Button onClick={() => void onAction(container.updateAction)}>
                                                {actionLabel[container.updateAction] ?? "Atualizar"}
                                            </Button>
                                        )}
                                        {container.removeable && (
                                            <Button
                                                color="error"
                                                onClick={() => void onAction(`delete_credential:${credential.id}`)}
                                                aria-label={`Remover ${credential.userLabel || text.title}`}
                                            >
                                                Remover
                                            </Button>
                                        )}
                                    </Stack>
                                }
                                sx={{ pr: { xs: 18, sm: 24 } }}
                            >
                                <ListItemIcon sx={{ display: { xs: "none", sm: "flex" } }}>{text.icon}</ListItemIcon>
                                <ListItemText
                                    primary={credential.userLabel || text.title}
                                    secondary={credential.createdDate ? `Criada em ${formatMillis(credential.createdDate)}` : undefined}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </CardContent>
        </Card>
    );
}
