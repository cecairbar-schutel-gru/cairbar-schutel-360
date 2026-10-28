import { useEffect, useMemo, useState, type FormEvent } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { PageHeader } from "../../../shared/components/PageHeader";
import { enumLabel, portal } from "../../../shared/i18n/pt-BR";
import { ProfileValidationError, useAccountApi, type Profile, type ProfileAttributeMetadata } from "../api";
import { LoadError, LoadingCards } from "../Feedback";
import { formatIsoDate } from "../format";
import { getValues, labelOf, optionsOf, translateError, withValues } from "../profile";
import { useProfile } from "../ProfileContext";

type Section = { key: string; title: string; description?: string; attributes: ProfileAttributeMetadata[] };

/** Agrupa os atributos pelos grupos do User Profile; os nativos (sem grupo) ficam em "Conta". */
function sectionsOf(profile: Profile): Section[] {
    const groups = profile.userProfileMetadata.groups ?? [];
    const sections = new Map<string, Section>();
    for (const attribute of profile.userProfileMetadata.attributes) {
        const key = attribute.group && attribute.group !== "user-metadata" ? attribute.group : "conta";
        if (!sections.has(key)) {
            const group = groups.find(g => g.name === key);
            sections.set(key, {
                key,
                title: key === "conta" ? "Conta" : (group?.displayHeader ?? key),
                description:
                    key === "conta" ? "Dados de acesso ao portal." : (group?.displayDescription ?? undefined),
                attributes: []
            });
        }
        sections.get(key)!.attributes.push(attribute);
    }
    return [...sections.values()];
}

function readOnlyText(attribute: ProfileAttributeMetadata, values: string[]): string {
    if (values.length === 0) return "—";
    if (attribute.annotations?.inputType === "html5-date") return values.map(formatIsoDate).join(", ");
    return values.map(v => enumLabel(attribute.name, v)).join(", ");
}

/** Validação no cliente só para orientar; quem decide é o Keycloak (validadores do User Profile). */
function validate(attribute: ProfileAttributeMetadata, value: string): string | undefined {
    if (value === "") {
        return attribute.required ? "Campo obrigatório." : undefined;
    }
    const { length, pattern, email } = attribute.validators;
    if (length?.max !== undefined && value.length > Number(length.max)) {
        return `Use no máximo ${length.max} caracteres.`;
    }
    if (length?.min !== undefined && value.length < Number(length.min)) {
        return `Use pelo menos ${length.min} caracteres.`;
    }
    if (pattern?.pattern !== undefined && !new RegExp(String(pattern.pattern)).test(value)) {
        return translateError(String(pattern["error-message"] ?? "error-pattern-no-match"));
    }
    if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return translateError("error-invalid-email");
    }
    return undefined;
}

export default function MeusDados() {
    const { data: profile, error, reload } = useProfile();

    if (error !== undefined) {
        return <LoadError onRetry={reload} />;
    }
    if (profile === undefined) {
        return <LoadingCards count={2} height={280} />;
    }
    return <ProfileForm profile={profile} onSaved={reload} />;
}

function ProfileForm(props: { profile: Profile; onSaved: () => void }) {
    const { profile, onSaved } = props;
    const api = useAccountApi();
    const sections = useMemo(() => sectionsOf(profile), [profile]);
    const editable = useMemo(
        () => profile.userProfileMetadata.attributes.filter(a => !a.readOnly),
        [profile]
    );

    const initial = useMemo(
        () => Object.fromEntries(editable.map(a => [a.name, getValues(profile, a.name)[0] ?? ""])),
        [profile, editable]
    );
    const [values, setValues] = useState<Record<string, string>>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => setValues(initial), [initial]);

    const isDirty = editable.some(a => values[a.name] !== initial[a.name]);

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setFormError(undefined);

        const clientErrors: Record<string, string> = {};
        for (const attribute of editable) {
            const message = validate(attribute, values[attribute.name].trim());
            if (message !== undefined) clientErrors[attribute.name] = message;
        }
        setErrors(clientErrors);
        if (Object.keys(clientErrors).length !== 0) {
            document.getElementById(Object.keys(clientErrors)[0])?.focus();
            return;
        }

        // Só os atributos editáveis mudam; os demais seguem como vieram do Keycloak.
        const changes = Object.fromEntries(
            editable.map(a => [a.name, values[a.name].trim() === "" ? [] : [values[a.name].trim()]])
        );

        setSaving(true);
        try {
            await api.saveProfile(withValues(profile, changes));
            setSaved(true);
            onSaved();
        } catch (e) {
            if (e instanceof ProfileValidationError) {
                const serverErrors: Record<string, string> = {};
                for (const { field, errorMessage } of e.errors) {
                    serverErrors[field] = translateError(errorMessage);
                }
                setErrors(serverErrors);
                const unknown = e.errors.filter(err => !editable.some(a => a.name === err.field));
                if (unknown.length !== 0) setFormError(translateError(unknown[0].errorMessage));
            } else {
                setFormError(portal.genericError);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <PageHeader title="Meus dados" description="Confira seus dados e atualize as informações de contato." />

            <Box component="form" noValidate onSubmit={onSubmit}>
                {formError !== undefined && (
                    <Alert severity="error" sx={{ mb: 2 }} role="alert">
                        {formError}
                    </Alert>
                )}

                <Stack spacing={2}>
                    {sections.map(section => (
                        <Card key={section.key} component="section" aria-labelledby={`secao-${section.key}`}>
                            <CardContent>
                                <Typography variant="h5" component="h2" id={`secao-${section.key}`}>
                                    {section.title}
                                </Typography>
                                {section.description !== undefined && (
                                    <Typography variant="body2" color="text.secondary">
                                        {section.description}
                                    </Typography>
                                )}
                                <Grid container columnSpacing={2}>
                                    {section.attributes.map(attribute => (
                                        <Grid key={attribute.name} size={{ xs: 12, sm: 6 }}>
                                            {attribute.readOnly ? (
                                                <TextField
                                                    id={attribute.name}
                                                    label={labelOf(attribute)}
                                                    value={readOnlyText(attribute, getValues(profile, attribute.name))}
                                                    helperText={portal.correctionHint}
                                                    slotProps={{
                                                        input: {
                                                            readOnly: true,
                                                            endAdornment: (
                                                                <LockOutlinedIcon fontSize="small" color="action" aria-hidden />
                                                            )
                                                        }
                                                    }}
                                                    variant="filled"
                                                />
                                            ) : (
                                                <EditableField
                                                    attribute={attribute}
                                                    value={values[attribute.name] ?? ""}
                                                    error={errors[attribute.name]}
                                                    onChange={value => setValues(v => ({ ...v, [attribute.name]: value }))}
                                                />
                                            )}
                                        </Grid>
                                    ))}
                                </Grid>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 3, justifyContent: "flex-end" }}>
                    <Button variant="outlined" disabled={!isDirty || saving} onClick={() => { setValues(initial); setErrors({}); }}>
                        Descartar alterações
                    </Button>
                    <Button type="submit" variant="contained" disabled={!isDirty} loading={saving}>
                        Salvar
                    </Button>
                </Stack>
            </Box>

            <Snackbar
                open={saved}
                autoHideDuration={4000}
                onClose={() => setSaved(false)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            >
                <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
                    Dados atualizados.
                </Alert>
            </Snackbar>
        </>
    );
}

function EditableField(props: {
    attribute: ProfileAttributeMetadata;
    value: string;
    error: string | undefined;
    onChange: (value: string) => void;
}) {
    const { attribute, value, error, onChange } = props;
    const inputType = String(attribute.annotations?.inputType ?? "text");
    const options = optionsOf(attribute);
    const type =
        attribute.name === "email" ? "email" : attribute.name === "mobilePhone" ? "tel" : inputType.startsWith("html5-") ? inputType.slice(6) : "text";
    const autoComplete: Record<string, string> = {
        email: "email",
        firstName: "given-name",
        lastName: "family-name",
        mobilePhone: "tel",
        preferredName: "nickname"
    };

    return (
        <TextField
            id={attribute.name}
            name={attribute.name}
            label={labelOf(attribute)}
            type={options.length === 0 ? type : undefined}
            select={options.length !== 0}
            value={value}
            onChange={event => onChange(event.target.value)}
            required={attribute.required}
            error={error !== undefined}
            helperText={error ?? (attribute.name === "mobilePhone" ? "Somente números, com DDD. Ex.: 11987654321" : undefined)}
            autoComplete={autoComplete[attribute.name]}
            slotProps={{ inputLabel: type === "date" ? { shrink: true } : undefined }}
        >
            {options.map(option => (
                <MenuItem key={option} value={option}>
                    {enumLabel(attribute.name, option)}
                </MenuItem>
            ))}
        </TextField>
    );
}
