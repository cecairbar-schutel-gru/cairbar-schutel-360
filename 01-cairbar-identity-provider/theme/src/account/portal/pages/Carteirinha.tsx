import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import WalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { BrandLogo } from "../../../shared/components/BrandLogo";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusChip } from "../../../shared/components/StatusChip";
import { portal } from "../../../shared/i18n/pt-BR";
import { brand } from "../../../shared/theme";
import { CardApiError, useAccountApi } from "../api";
import { LoadError, LoadingCards } from "../Feedback";
import { formatMillis } from "../format";
import { displayName, getValue } from "../profile";
import { useProfile } from "../ProfileContext";
import { useAsync } from "../useAsync";

/** Mensagens para os códigos de erro do Serviço de Carteirinha (sem detalhes técnicos). */
function issueErrorMessage(error: unknown): string {
    const code = error instanceof CardApiError ? error.code : undefined;
    switch (code) {
        case "IDENTITY_NOT_ACTIVE":
            return `Sua identidade não está ativa, por isso a carteirinha não pode ser emitida. ${portal.correctionHint}`;
        case "CARD_BLOCKED":
            return `Sua carteirinha está suspensa ou revogada. ${portal.correctionHint}`;
        case "GOOGLE_WALLET_UNAVAILABLE":
            return "O Google Wallet não respondeu. Tente novamente em instantes.";
        default:
            return portal.genericError;
    }
}

/**
 * Minha carteirinha: personId e cardStatus vêm do Keycloak (System of Record).
 *
 * A própria pessoa emite a carteirinha ao adicioná-la ao Google Wallet: o Serviço de
 * Carteirinha (/api/v1/cards, seção 11.1) cria o passe com o QR org:person:<personId>
 * (regra 3) e devolve o link "Salvar no Google Wallet". O portal não gera QR no navegador.
 * TODO: Apple Wallet (próximo passo).
 * TODO(seção 23.6): foto na carteirinha — não exibir foto até haver decisão.
 */
export default function Carteirinha() {
    const { data: profile, error, reload } = useProfile();
    const api = useAccountApi();
    const personId = profile === undefined ? undefined : getValue(profile, "personId");
    // Situação no serviço (carteiras já adicionadas); falha aqui não impede a emissão.
    const card = useAsync(signal => (personId === undefined ? Promise.resolve(undefined) : api.getCard(personId, signal)), [personId]);
    const [confirming, setConfirming] = useState(false);
    const [issuing, setIssuing] = useState(false);
    const [issueError, setIssueError] = useState<string>();

    async function addToGoogleWallet() {
        if (personId === undefined) {
            return;
        }
        setIssuing(true);
        setIssueError(undefined);
        try {
            const { saveUrl } = await api.issueGoogleWallet(personId);
            setConfirming(false);
            // O link abre o Google Wallet (app no Android, página do Google no navegador).
            window.location.assign(saveUrl);
            reload();
            card.reload();
        } catch (reason) {
            setConfirming(false);
            setIssueError(issueErrorMessage(reason));
        } finally {
            setIssuing(false);
        }
    }

    if (error !== undefined) {
        return <LoadError onRetry={reload} />;
    }
    if (profile === undefined) {
        return <LoadingCards count={1} height={240} />;
    }

    const cardStatus = getValue(profile, "cardStatus");
    const identityActive = getValue(profile, "identityStatus") === "ACTIVE";
    const blocked = cardStatus === "SUSPENDED" || cardStatus === "REVOKED";
    const canIssue = personId !== undefined && identityActive && !blocked;
    const googleWallet = card.data?.wallets.find(w => w.provider === "GOOGLE" && w.status === "ACTIVE");
    const name = getValue(profile, "fullName") ?? [profile.firstName, profile.lastName].filter(Boolean).join(" ");

    return (
        <>
            <PageHeader title="Minha carteirinha" description="Sua identificação no CE Cairbar Schutel." />

            {!identityActive ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Sua identidade não está ativa, por isso a carteirinha não pode ser usada. {portal.correctionHint}
                </Alert>
            ) : blocked ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Sua carteirinha não está ativa. {portal.correctionHint}
                </Alert>
            ) : (
                cardStatus !== "ACTIVE" && (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        Sua carteirinha ainda não foi emitida. Adicione-a à sua carteira digital para emiti-la.
                    </Alert>
                )
            )}

            {issueError !== undefined && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setIssueError(undefined)}>
                    {issueError}
                </Alert>
            )}

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 7 }}>
                    <Paper
                        component="section"
                        aria-label="Carteirinha digital"
                        variant="outlined"
                        sx={{
                            p: 3,
                            borderRadius: 4,
                            maxWidth: 480,
                            aspectRatio: { sm: "1.586" },
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            // Faixas do logotipo como marca d'água no canto.
                            backgroundImage: `repeating-linear-gradient(180deg, transparent 0 14px, ${brand.stripe}33 14px 22px)`,
                            backgroundSize: "35% 100%",
                            backgroundPosition: "right top",
                            backgroundRepeat: "no-repeat"
                        }}
                    >
                        <BrandLogo height={36} sx={{ alignSelf: "flex-start" }} />
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                                Nome
                            </Typography>
                            <Typography variant="h5" component="p" sx={{ fontWeight: 700 }}>
                                {name || "—"}
                            </Typography>
                            <Stack direction="row" spacing={3} sx={{ mt: 2, alignItems: "flex-end", flexWrap: "wrap" }} useFlexGap>
                                <div>
                                    <Typography variant="body2" color="text.secondary">
                                        Identificador
                                    </Typography>
                                    <Typography sx={{ fontFamily: "monospace", fontSize: "1.25rem", letterSpacing: 1 }}>
                                        {personId ?? "—"}
                                    </Typography>
                                </div>
                                <div>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                        Situação
                                    </Typography>
                                    <StatusChip kind="card" status={cardStatus} />
                                </div>
                            </Stack>
                        </Box>
                    </Paper>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                    <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                        <QrCode2Icon sx={{ fontSize: 96, color: canIssue ? "primary.main" : "text.disabled" }} aria-hidden />
                        <Typography variant="h6" component="h2">
                            QR Code da carteirinha
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 1 }}>
                            Adicione a carteirinha ao celular para apresentar o QR Code nas atividades do centro.
                        </Typography>
                        {googleWallet !== undefined && (
                            <Typography variant="body2" sx={{ mt: 2 }}>
                                Adicionada ao Google Wallet em {formatMillis(Date.parse(googleWallet.issuedAt))}.
                            </Typography>
                        )}
                        <Stack spacing={1} sx={{ mt: 3 }}>
                            <Button
                                variant="contained"
                                startIcon={<WalletOutlinedIcon />}
                                disabled={!canIssue}
                                loading={issuing}
                                onClick={() => setConfirming(true)}
                            >
                                {googleWallet === undefined ? "Adicionar ao Google Wallet" : "Adicionar de novo ao Google Wallet"}
                            </Button>
                            <Button variant="outlined" startIcon={<WalletOutlinedIcon />} disabled>
                                Adicionar à Apple Wallet (em breve)
                            </Button>
                        </Stack>
                        {/* TODO: trocar pelo botão oficial "Adicionar ao Google Wallet" (diretrizes de marca do Google), auto-hospedado. */}
                    </Paper>
                </Grid>
            </Grid>

            <ConfirmDialog
                open={confirming}
                title="Adicionar ao Google Wallet"
                description={
                    <>
                        Para criar a carteirinha no Google Wallet, enviamos ao Google somente seu nome de preferência
                        ({displayName(profile) || "—"}) e seu identificador ({personId}). O QR Code contém apenas o
                        identificador. Em seguida você será levado ao Google para salvá-la.
                    </>
                }
                confirmLabel="Continuar"
                busy={issuing}
                onConfirm={addToGoogleWallet}
                onClose={() => setConfirming(false)}
            />
        </>
    );
}
