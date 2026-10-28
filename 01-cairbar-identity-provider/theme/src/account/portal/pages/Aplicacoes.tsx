import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { EmptyState } from "../../../shared/components/EmptyState";
import { PageHeader } from "../../../shared/components/PageHeader";
import { portal } from "../../../shared/i18n/pt-BR";
import { useAccountApi, type ClientRepresentation } from "../api";
import { clientLabel } from "../clients";
import { LoadError, LoadingCards } from "../Feedback";
import { formatMillis } from "../format";
import { useAsync } from "../useAsync";

export default function Aplicacoes() {
    const api = useAccountApi();
    const { data, error, loading, reload } = useAsync(signal => api.getApplications(signal));
    const [revoking, setRevoking] = useState<ClientRepresentation>();
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(false);

    // O cliente "account" (legado) não tem utilidade para o voluntário.
    const applications = (data ?? []).filter(app => app.clientId !== "account");

    const revoke = async () => {
        if (revoking === undefined) return;
        setBusy(true);
        setActionError(false);
        try {
            await api.deleteConsent(revoking.clientId);
            reload();
        } catch {
            setActionError(true);
        } finally {
            setBusy(false);
            setRevoking(undefined);
        }
    };

    return (
        <>
            <PageHeader
                title="Aplicações da organização"
                description="Sistemas que usam sua conta e as permissões que você concedeu."
            />
            {actionError && (
                <Alert severity="error" sx={{ mb: 2 }} role="alert">
                    {portal.genericError}
                </Alert>
            )}
            {error !== undefined ? (
                <LoadError onRetry={reload} />
            ) : loading && data === undefined ? (
                <LoadingCards count={2} />
            ) : applications.length === 0 ? (
                <Card>
                    <EmptyState icon={<AppsOutlinedIcon />} title="Nenhuma aplicação disponível." />
                </Card>
            ) : (
                <Grid container spacing={2}>
                    {applications.map(app => (
                        <Grid key={app.clientId} size={{ xs: 12, md: 6 }}>
                            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                                <CardContent sx={{ flex: 1 }}>
                                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                                        <Typography variant="h6" component="h2">
                                            {clientLabel(app)}
                                        </Typography>
                                        {app.inUse && <Chip size="small" color="success" variant="outlined" label="Em uso" />}
                                        {app.offlineAccess && <Chip size="small" variant="outlined" label="Acesso offline" />}
                                    </Stack>
                                    {app.description && !app.description.startsWith("${") && (
                                        <Typography variant="body2" color="text.secondary">
                                            {app.description}
                                        </Typography>
                                    )}
                                    {app.consent !== undefined && (
                                        <>
                                            <Typography variant="body2" sx={{ mt: 1.5 }}>
                                                Permissões concedidas em {formatMillis(app.consent.createdDate)}:
                                            </Typography>
                                            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 0.5 }}>
                                                {app.consent.grantedScopes.map(scope => (
                                                    <Chip key={scope.id} size="small" label={scope.displayText || scope.name} />
                                                ))}
                                            </Stack>
                                        </>
                                    )}
                                </CardContent>
                                <CardActions sx={{ justifyContent: "flex-end" }}>
                                    {app.consent !== undefined && (
                                        <Button color="error" onClick={() => setRevoking(app)}>
                                            Revogar permissões
                                        </Button>
                                    )}
                                    {app.effectiveUrl && app.clientId !== "account-console" && (
                                        <Button
                                            href={app.effectiveUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            endIcon={<OpenInNewIcon aria-hidden />}
                                            aria-label={`Abrir ${clientLabel(app)} (nova aba)`}
                                        >
                                            Abrir
                                        </Button>
                                    )}
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <ConfirmDialog
                open={revoking !== undefined}
                title="Revogar permissões?"
                description={`${revoking === undefined ? "" : clientLabel(revoking)} deixará de acessar seus dados até que você autorize de novo.`}
                confirmLabel="Revogar"
                destructive
                busy={busy}
                onConfirm={() => void revoke()}
                onClose={() => setRevoking(undefined)}
            />
        </>
    );
}
