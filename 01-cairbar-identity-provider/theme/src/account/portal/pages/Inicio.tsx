import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { PageHeader } from "../../../shared/components/PageHeader";
import { StatusChip } from "../../../shared/components/StatusChip";
import { portal, relationshipLabel, type Relationship } from "../../../shared/i18n/pt-BR";
import { LoadError, LoadingCards } from "../Feedback";
import { navItems } from "../nav";
import { displayName, getValue, getValues } from "../profile";
import { useProfile } from "../ProfileContext";

const shortcuts = navItems.filter(item => ["/meus-dados", "/seguranca", "/dispositivos"].includes(item.to));

export default function Inicio() {
    const { data: profile, error, reload } = useProfile();

    if (error !== undefined) {
        return <LoadError onRetry={reload} />;
    }
    if (profile === undefined) {
        return <LoadingCards count={3} />;
    }

    const identityStatus = getValue(profile, "identityStatus");
    const cardStatus = getValue(profile, "cardStatus");
    const relationships = getValues(profile, "relationships");

    return (
        <>
            <PageHeader title={`Olá, ${displayName(profile)}!`} description={`Bem-vindo(a) à ${portal.productName}.`} />

            {(identityStatus === "SUSPENDED" || identityStatus === "INACTIVE") && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Sua identidade não está ativa. {portal.correctionHint}
                </Alert>
            )}

            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: "100%" }}>
                        <CardContent>
                            <Typography variant="h5" component="h2" gutterBottom>
                                Minha identidade
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Identificador
                            </Typography>
                            <Typography sx={{ fontFamily: "monospace", fontSize: "1.125rem", mb: 1.5 }}>
                                {getValue(profile, "personId") ?? "—"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                Situação
                            </Typography>
                            <StatusChip kind="identity" status={identityStatus} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                        <CardContent sx={{ flex: 1 }}>
                            <Typography variant="h5" component="h2" gutterBottom>
                                Minha carteirinha
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                Situação
                            </Typography>
                            <StatusChip kind="card" status={cardStatus} />
                        </CardContent>
                        <CardActions>
                            <Button component={RouterLink} to="/carteirinha" endIcon={<ArrowForwardIcon />}>
                                Ver carteirinha
                            </Button>
                        </CardActions>
                    </Card>
                </Grid>
                <Grid size={12}>
                    <Card>
                        <CardContent>
                            <Typography variant="h5" component="h2" gutterBottom>
                                Meus vínculos com o centro
                            </Typography>
                            {relationships.length === 0 ? (
                                <Typography color="text.secondary">Nenhum vínculo registrado. {portal.correctionHint}</Typography>
                            ) : (
                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }} component="ul" aria-label="Vínculos" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                    {relationships.map(r => (
                                        <li key={r}>
                                            <Chip label={relationshipLabel[r as Relationship] ?? r} color="primary" variant="outlined" />
                                        </li>
                                    ))}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            <Typography variant="h5" component="h2" sx={{ mt: 4, mb: 2 }}>
                Atalhos
            </Typography>
            <Grid container spacing={2}>
                {shortcuts.map(item => (
                    <Grid key={item.to} size={{ xs: 12, sm: 4 }}>
                        <Button
                            component={RouterLink}
                            to={item.to}
                            variant="outlined"
                            fullWidth
                            startIcon={item.icon}
                            sx={{ justifyContent: "flex-start", py: 1.5, bgcolor: "background.paper" }}
                        >
                            <Box component="span">{item.label}</Box>
                        </Button>
                    </Grid>
                ))}
            </Grid>
        </>
    );
}
