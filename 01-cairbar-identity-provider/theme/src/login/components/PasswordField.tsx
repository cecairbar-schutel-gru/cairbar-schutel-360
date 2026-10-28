import { useState, type ReactNode } from "react";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { I18n } from "../i18n";

export function PasswordField(props: {
    i18n: I18n;
    id: string;
    name: string;
    label: ReactNode;
    autoComplete: "current-password" | "new-password";
    autoFocus?: boolean;
    error?: boolean;
    helperText?: ReactNode;
    required?: boolean;
}) {
    const { i18n, id, name, label, autoComplete, autoFocus, error, helperText, required } = props;
    const [revealed, setRevealed] = useState(false);
    const toggleLabel = i18n.msgStr(revealed ? "portalHidePassword" : "portalShowPassword");

    return (
        <TextField
            id={id}
            name={name}
            label={label}
            type={revealed ? "text" : "password"}
            autoComplete={autoComplete}
            autoFocus={autoFocus}
            required={required}
            error={error}
            helperText={helperText}
            slotProps={{
                htmlInput: { "aria-invalid": error || undefined },
                formHelperText: { "aria-live": "polite" } as object,
                input: {
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                aria-label={toggleLabel}
                                aria-controls={id}
                                aria-pressed={revealed}
                                onClick={() => setRevealed(!revealed)}
                                edge="end"
                            >
                                {revealed ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                        </InputAdornment>
                    )
                }
            }}
        />
    );
}
