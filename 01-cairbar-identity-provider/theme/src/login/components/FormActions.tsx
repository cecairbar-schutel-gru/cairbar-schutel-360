import type { ReactNode } from "react";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import type { I18n } from "../i18n";

/**
 * Botão principal de envio e, em ações iniciadas pela aplicação (AIA, ex.: "alterar senha"
 * vindo do portal), o botão Cancelar que devolve o usuário sem concluir a ação.
 */
export function FormActions(props: {
    i18n: I18n;
    submitLabel: ReactNode;
    isAppInitiatedAction?: boolean;
    submitName?: string;
    submitDisabled?: boolean;
}) {
    const { i18n, submitLabel, isAppInitiatedAction = false, submitName, submitDisabled = false } = props;

    // O botão principal vem primeiro no DOM: Enter envia pelo primeiro submit do formulário.
    return (
        <Stack direction={{ xs: "column", sm: "row-reverse" }} spacing={1.5} sx={{ mt: 3 }}>
            <Button type="submit" name={submitName} variant="contained" size="large" fullWidth disabled={submitDisabled}>
                {submitLabel}
            </Button>
            {isAppInitiatedAction && (
                <Button type="submit" name="cancel-aia" value="true" variant="outlined" size="large" fullWidth formNoValidate>
                    {i18n.msg("doCancel")}
                </Button>
            )}
        </Stack>
    );
}
