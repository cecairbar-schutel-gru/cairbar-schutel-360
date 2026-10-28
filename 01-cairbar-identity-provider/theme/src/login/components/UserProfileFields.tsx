import { Fragment, useEffect } from "react";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import type { Attribute } from "keycloakify/login/KcContext";
import { useUserProfileForm, type FormFieldState } from "keycloakify/login/lib/useUserProfileForm";
import { attributeLabel, enumLabel } from "../../shared/i18n/pt-BR";
import type { I18n } from "../i18n";
import type { KcContext } from "../KcContext";

type KcContextWithProfile = Extract<
    KcContext,
    { pageId: "login-update-profile.ftl" | "update-email.ftl" | "idp-review-user-profile.ftl" }
>;

/**
 * Campos do User Profile em MUI, a partir dos metadados enviados pelo Keycloak (permissões,
 * validações e anotações de realm/cecairbar.yml). Atributos sem permissão de edição para o
 * usuário (personId, fullName, status...) aparecem desabilitados e não são enviados.
 */
export function UserProfileFields(props: {
    kcContext: KcContextWithProfile;
    i18n: I18n;
    onIsFormSubmittableValueChange: (isFormSubmittable: boolean) => void;
}) {
    const { kcContext, i18n, onIsFormSubmittableValueChange } = props;
    const {
        formState: { formFieldStates, isFormSubmittable },
        dispatchFormAction
    } = useUserProfileForm({ kcContext, i18n, doMakeUserConfirmPassword: false });

    useEffect(() => {
        onIsFormSubmittableValueChange(isFormSubmittable);
    }, [isFormSubmittable]);

    let currentGroup: string | undefined;

    return (
        <>
            {formFieldStates.map(state => {
                const { attribute } = state;
                const groupName = attribute.group?.name;
                const showGroupHeader = groupName !== undefined && groupName !== currentGroup;
                currentGroup = groupName;

                if (attribute.annotations.inputType === "hidden") {
                    return <input key={attribute.name} type="hidden" name={attribute.name} value={String(state.valueOrValues)} />;
                }

                return (
                    <Fragment key={attribute.name}>
                        {showGroupHeader && attribute.group !== undefined && (
                            <Typography variant="h6" component="h2" sx={{ mt: 3 }}>
                                {i18n.advancedMsgStr(attribute.group.displayHeader ?? attribute.group.name)}
                            </Typography>
                        )}
                        <Field
                            state={state}
                            i18n={i18n}
                            onChange={valueOrValues =>
                                dispatchFormAction({ action: "update", name: attribute.name, valueOrValues })
                            }
                            onBlur={() =>
                                dispatchFormAction({ action: "focus lost", name: attribute.name, fieldIndex: undefined })
                            }
                        />
                    </Fragment>
                );
            })}
        </>
    );
}

function labelOf(attribute: Attribute, i18n: I18n) {
    const fromRealm = i18n.advancedMsgStr(attribute.displayName ?? "");
    return attributeLabel[attribute.name] ?? (fromRealm || attribute.name);
}

function optionsOf(attribute: Attribute): string[] {
    return attribute.validators.options?.options ?? [];
}

function Field(props: {
    state: FormFieldState;
    i18n: I18n;
    onChange: (valueOrValues: string | string[]) => void;
    onBlur: () => void;
}) {
    const { state, i18n, onChange, onBlur } = props;
    const { attribute, displayableErrors, valueOrValues } = state;
    const label = labelOf(attribute, i18n);
    const error = displayableErrors.length !== 0;
    const helperText = error
        ? displayableErrors.map(({ errorMessageStr }) => errorMessageStr).join(" ")
        : attribute.readOnly
          ? i18n.msgStr("portalProfileReadOnlyHint")
          : attribute.annotations.inputHelperTextAfter !== undefined
            ? i18n.advancedMsgStr(attribute.annotations.inputHelperTextAfter)
            : undefined;
    const inputType = attribute.annotations.inputType ?? "text";
    const helperId = `${attribute.name}-helper`;

    // Só leitura e sem "name": o valor é exibido, mas não vai no POST (o Keycloak recusaria a alteração).
    if (attribute.readOnly) {
        const values = (Array.isArray(valueOrValues) ? valueOrValues : [valueOrValues]).filter(v => v !== "");
        return (
            <TextField
                id={attribute.name}
                label={label}
                value={values.length === 0 ? "—" : values.map(v => enumLabel(attribute.name, v)).join(", ")}
                helperText={helperText}
                variant="filled"
                slotProps={{
                    input: {
                        readOnly: true,
                        endAdornment: <LockOutlinedIcon fontSize="small" color="action" aria-hidden />
                    }
                }}
            />
        );
    }

    if (inputType === "select" || inputType === "multiselect" || attribute.multivalued) {
        const multiple = inputType === "multiselect" || attribute.multivalued === true;
        const values = Array.isArray(valueOrValues) ? valueOrValues.filter(v => v !== "") : [valueOrValues];
        const labelId = `${attribute.name}-label`;
        const options = optionsOf(attribute);

        return (
            <FormControl fullWidth margin="normal" error={error} disabled={attribute.readOnly} required={attribute.required}>
                <InputLabel id={labelId}>{label}</InputLabel>
                <Select
                    labelId={labelId}
                    id={attribute.name}
                    label={label}
                    multiple={multiple}
                    value={multiple ? values : (values[0] ?? "")}
                    onChange={event => onChange(event.target.value as string | string[])}
                    onBlur={onBlur}
                    aria-describedby={helperText === undefined ? undefined : helperId}
                    renderValue={selected =>
                        multiple ? (
                            <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                                {(selected as string[]).map(v => (
                                    <Chip key={v} size="small" label={enumLabel(attribute.name, v)} />
                                ))}
                            </Stack>
                        ) : (
                            enumLabel(attribute.name, selected as string)
                        )
                    }
                >
                    {options.map(option => (
                        <MenuItem key={option} value={option}>
                            {multiple && <Checkbox checked={values.includes(option)} />}
                            <ListItemText primary={enumLabel(attribute.name, option)} />
                        </MenuItem>
                    ))}
                </Select>
                {/* O Select do MUI juntaria múltiplos valores com vírgula; o Keycloak espera um campo por valor. */}
                {!attribute.readOnly &&
                    values.map((v, i) => <input key={i} type="hidden" name={attribute.name} value={v} />)}
                {helperText !== undefined && <FormHelperText id={helperId}>{helperText}</FormHelperText>}
            </FormControl>
        );
    }

    const htmlType = inputType.startsWith("html5-") ? inputType.slice(6) : inputType === "text" ? "text" : inputType;

    return (
        <TextField
            id={attribute.name}
            name={attribute.name}
            label={label}
            type={htmlType}
            value={Array.isArray(valueOrValues) ? (valueOrValues[0] ?? "") : valueOrValues}
            onChange={event => onChange(event.target.value)}
            onBlur={onBlur}
            disabled={attribute.readOnly}
            required={attribute.required && !attribute.readOnly}
            error={error}
            helperText={helperText}
            autoComplete={attribute.autocomplete}
            slotProps={{
                inputLabel: htmlType === "date" ? { shrink: true } : undefined,
                htmlInput: {
                    "aria-invalid": error || undefined,
                    pattern: attribute.annotations.inputTypePattern,
                    maxLength:
                        attribute.annotations.inputTypeMaxlength === undefined
                            ? undefined
                            : Number(attribute.annotations.inputTypeMaxlength)
                }
            }}
        />
    );
}
