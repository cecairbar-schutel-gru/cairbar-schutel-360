import { attributeLabel } from "../../shared/i18n/pt-BR";
import type { Profile, ProfileAttributeMetadata } from "./api";

/** Atributos nativos que a Account REST API coloca na raiz da representação. */
const rootAttributes = new Set(["username", "email", "firstName", "lastName"]);

export function getValues(profile: Profile, name: string): string[] {
    if (rootAttributes.has(name)) {
        const value = profile[name as "username" | "email" | "firstName" | "lastName"];
        return value === undefined || value === "" ? [] : [value];
    }
    return (profile.attributes?.[name] ?? []).filter(v => v !== "");
}

export function getValue(profile: Profile, name: string): string | undefined {
    return getValues(profile, name)[0];
}

/** Nova representação com os valores alterados (sem mutar a original). */
export function withValues(profile: Profile, changes: Record<string, string[]>): Profile {
    const next: Profile = { ...profile, attributes: { ...profile.attributes } };
    for (const [name, values] of Object.entries(changes)) {
        if (rootAttributes.has(name)) {
            (next as Record<string, unknown>)[name] = values[0] ?? "";
        } else {
            next.attributes![name] = values;
        }
    }
    return next;
}

/** Nome exibido no portal: nome de preferência > nome > nome completo > usuário. */
export function displayName(profile: Profile): string {
    return (
        getValue(profile, "preferredName") ??
        getValue(profile, "firstName") ??
        getValue(profile, "fullName") ??
        getValue(profile, "username") ??
        ""
    );
}

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Rótulo do atributo: tabela pt-BR do portal ou displayName do realm (sem "${...}"). */
export function labelOf(attribute: ProfileAttributeMetadata): string {
    const fromRealm = attribute.displayName?.startsWith("${") ? undefined : attribute.displayName;
    return attributeLabel[attribute.name] ?? fromRealm ?? attribute.name;
}

export function optionsOf(attribute: ProfileAttributeMetadata): string[] {
    const options = attribute.validators.options?.options;
    return Array.isArray(options) ? (options as string[]) : [];
}

/** Tradução das mensagens de erro do Keycloak mais comuns no POST /account/. */
const errorMessages: Record<string, string> = {
    "error-user-attribute-read-only": "Este campo não pode ser alterado por você.",
    "error-invalid-email": "Informe um e-mail válido.",
    invalidEmailMessage: "Informe um e-mail válido.",
    "error-invalid-length": "Tamanho inválido.",
    "error-invalid-value": "Valor inválido.",
    "error-user-attribute-required": "Campo obrigatório.",
    "error-person-name-invalid-character": "O nome contém caracteres não permitidos.",
    "error-pattern-no-match": "Formato inválido.",
    emailExistsMessage: "Este e-mail já está em uso.",
    "error-invalid-date": "Data inválida."
};

export function translateError(message: string): string {
    // O realm pode enviar a mensagem personalizada do validador (ex.: "Celular deve conter...").
    return errorMessages[message] ?? (message.includes(" ") ? message : "Valor inválido.");
}
