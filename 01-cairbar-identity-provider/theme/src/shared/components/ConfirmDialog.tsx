import { useId, type ReactNode } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export function ConfirmDialog(props: {
    open: boolean;
    title: ReactNode;
    description: ReactNode;
    confirmLabel: string;
    destructive?: boolean;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const { open, title, description, confirmLabel, destructive = false, busy = false, onConfirm, onClose } = props;
    const titleId = useId();
    const descriptionId = useId();

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} aria-labelledby={titleId} aria-describedby={descriptionId}>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id={descriptionId}>{description}</DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Cancelar
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color={destructive ? "error" : "primary"}
                    loading={busy}
                >
                    {confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
