import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ComputerIcon from "@mui/icons-material/Computer";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { PageHeader } from "../../../shared/components/PageHeader";
import { portal } from "../../../shared/i18n/pt-BR";
import { useAccountApi, type DeviceRepresentation } from "../api";
import { LoadError, LoadingCards } from "../Feedback";
import { formatSeconds } from "../format";
import { useAsync } from "../useAsync";
import { clientLabel } from "../clients";

type Pending = { kind: "one"; sessionId: string; label: string } | { kind: "others" };

export default function Dispositivos() {
    const api = useAccountApi();
    const { data, error, loading, reload } = useAsync(signal => api.getDevices(signal));
    const [pending, setPending] = useState<Pending>();
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(false);

    const sessions = (data ?? []).flatMap(device => device.sessions.map(session => ({ device, session })));
    const hasOthers = sessions.some(({ session }) => !session.current);

    const confirm = async () => {
        if (pending === undefined) return;
        setBusy(true);
        setActionError(false);
        try {
            await api.deleteSession(pending.kind === "one" ? pending.sessionId : undefined);
            reload();
        } catch {
            setActionError(true);
        } finally {
            setBusy(false);
            setPending(undefined);
        }
    };

    return (
        <>
            <PageHeader
                title="Dispositivos e sessões"
                description="Onde sua conta está conectada. Encerre sessões que você não reconhece."
                action={
                    hasOthers && (
                        <Button variant="outlined" color="error" onClick={() => setPending({ kind: "others" })}>
                            Encerrar as outras sessões
                        </Button>
                    )
                }
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
            ) : (
                <Stack spacing={2} component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
                    {sessions.map(({ device, session }) => (
                        <Card component="li" key={session.id}>
                            <CardContent>
                                <Stack direction="row" spacing={2}>
                                    <Typography color="primary" aria-hidden>
                                        {device.mobile ? <SmartphoneIcon /> : <ComputerIcon />}
                                    </Typography>
                                    <div>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                                            <Typography variant="h6" component="h2">
                                                {deviceLabel(device)}
                                            </Typography>
                                            {session.current && <Chip size="small" color="success" variant="outlined" label="Este dispositivo" />}
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            {session.browser} · IP {session.ipAddress}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Último acesso: {formatSeconds(session.lastAccess)} · Iniciada: {formatSeconds(session.started)} ·
                                            Expira: {formatSeconds(session.expires)}
                                        </Typography>
                                        {session.clients.length !== 0 && (
                                            <Typography variant="body2" sx={{ mt: 1 }}>
                                                Aplicações: {session.clients.map(clientLabel).join(", ")}
                                            </Typography>
                                        )}
                                    </div>
                                </Stack>
                            </CardContent>
                            {!session.current && (
                                <CardActions sx={{ justifyContent: "flex-end" }}>
                                    <Button
                                        color="error"
                                        onClick={() => setPending({ kind: "one", sessionId: session.id, label: deviceLabel(device) })}
                                    >
                                        Encerrar sessão
                                    </Button>
                                </CardActions>
                            )}
                        </Card>
                    ))}
                </Stack>
            )}

            <ConfirmDialog
                open={pending !== undefined}
                title={pending?.kind === "others" ? "Encerrar as outras sessões?" : "Encerrar sessão?"}
                description={
                    pending?.kind === "one"
                        ? `A sessão em ${pending.label} será encerrada e será preciso entrar de novo nesse dispositivo.`
                        : "Todas as sessões, exceto a deste dispositivo, serão encerradas."
                }
                confirmLabel="Encerrar"
                destructive
                busy={busy}
                onConfirm={() => void confirm()}
                onClose={() => setPending(undefined)}
            />
        </>
    );
}

function deviceLabel(device: DeviceRepresentation): string {
    const os = [device.os, device.osVersion].filter(v => v && v !== "Other" && v !== "Unknown").join(" ");
    return os || (device.mobile ? "Celular" : "Computador");
}
