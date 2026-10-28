import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

type Subscribe = (
    onTick: (params: { secondsLeft: number | undefined }) => void
) => { unsubscribeFromAutoLogoutCountdown: () => void };

/**
 * Aviso de encerramento por inatividade (substitui o SessionExpirationWarningOverlay do
 * account-ui, que é em inglês). O logout automático é feito pelo oidc-spa.
 */
export function SessionExpiryDialog(props: { subscribe: Subscribe; warnSecondsBefore: number }) {
    const { subscribe, warnSecondsBefore } = props;
    const [secondsLeft, setSecondsLeft] = useState<number>();

    useEffect(() => {
        const { unsubscribeFromAutoLogoutCountdown } = subscribe(({ secondsLeft }) =>
            setSecondsLeft(secondsLeft !== undefined && secondsLeft <= warnSecondsBefore ? secondsLeft : undefined)
        );
        return unsubscribeFromAutoLogoutCountdown;
    }, []);

    return (
        <Dialog open={secondsLeft !== undefined} aria-labelledby="sessao-expirando" aria-describedby="sessao-expirando-texto">
            <DialogTitle id="sessao-expirando">Sua sessão vai expirar</DialogTitle>
            <DialogContent>
                <DialogContentText id="sessao-expirando-texto" aria-live="polite">
                    Por inatividade, você sairá do portal em <strong>{secondsLeft}</strong> segundos. Mova o mouse ou
                    pressione uma tecla para continuar conectado.
                </DialogContentText>
            </DialogContent>
        </Dialog>
    );
}
