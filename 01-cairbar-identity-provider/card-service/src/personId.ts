/** Formato do identificador da pessoa (seção 7.2), igual à validação do User Profile. */
export const PERSON_ID_PATTERN = /^PER-[0-9]{8}$/;

export function isPersonId(value: unknown): value is string {
    return typeof value === "string" && PERSON_ID_PATTERN.test(value);
}

/**
 * Conteúdo do QR Code (seção 9.3): só a referência à pessoa — nunca nome, documentos,
 * contatos, roles, tokens ou dados transacionais (regra 3).
 */
export function qrValue(personId: string): string {
    if (!isPersonId(personId)) {
        throw new Error("personId inválido");
    }
    return `org:person:${personId}`;
}
