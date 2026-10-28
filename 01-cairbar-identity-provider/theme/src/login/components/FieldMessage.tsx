import { kcSanitize } from "keycloakify/lib/kcSanitize";

/** Mensagem de erro do servidor para um campo (pode conter HTML do Keycloak, sempre sanitizado). */
export function FieldMessage(props: { html: string }) {
    return <span dangerouslySetInnerHTML={{ __html: kcSanitize(props.html) }} />;
}
