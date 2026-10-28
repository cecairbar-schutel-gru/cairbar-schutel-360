import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { portal } from "../../shared/i18n/pt-BR";

/** Erro de carregamento genérico (sem detalhes técnicos), com nova tentativa. */
export function LoadError(props: { onRetry: () => void }) {
    return (
        <Alert
            severity="error"
            action={
                <Button color="inherit" size="small" onClick={props.onRetry}>
                    Tentar de novo
                </Button>
            }
        >
            {portal.genericError}
        </Alert>
    );
}

export function LoadingCards(props: { count?: number; height?: number }) {
    const { count = 2, height = 120 } = props;
    return (
        <Stack spacing={2} aria-busy="true" aria-label="Carregando">
            {Array.from({ length: count }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={height} />
            ))}
        </Stack>
    );
}
