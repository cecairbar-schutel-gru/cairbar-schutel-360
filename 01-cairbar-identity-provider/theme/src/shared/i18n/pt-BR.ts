/**
 * Rótulos do portal e tradução dos valores enumerados do User Profile
 * (ansible/realm/cecairbar.yml). O portal só fala pt-BR (defaultLocale do realm).
 */

export type IdentityStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type CardStatus = "NOT_ISSUED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
export type Relationship = "VOLUNTEER" | "PARTICIPANT";

export const identityStatusLabel: Record<IdentityStatus, string> = {
    ACTIVE: "Ativa",
    INACTIVE: "Inativa",
    SUSPENDED: "Suspensa"
};

export const cardStatusLabel: Record<CardStatus, string> = {
    NOT_ISSUED: "Não emitida",
    ACTIVE: "Ativa",
    SUSPENDED: "Suspensa",
    REVOKED: "Revogada"
};

export const relationshipLabel: Record<Relationship, string> = {
    VOLUNTEER: "Voluntário(a)",
    PARTICIPANT: "Participante"
};

/** Nomes amigáveis dos grupos do realm (seção 8.5); grupos novos caem no nome do Keycloak. */
export const groupLabel: Record<string, string> = {
    "/participantes": "Participantes",
    "/voluntarios": "Voluntários",
    "/voluntarios/operadores": "Operadores",
    "/voluntarios/biblioteca": "Biblioteca",
    "/voluntarios/eventos": "Eventos",
    "/voluntarios/vendas": "Vendas",
    "/tesouraria": "Tesouraria",
    "/administradores": "Administradores"
};

/** Rótulos dos atributos do User Profile (o displayName do realm pode vir como ${chave}). */
export const attributeLabel: Record<string, string> = {
    username: "Usuário",
    email: "E-mail",
    firstName: "Nome",
    lastName: "Sobrenome",
    personId: "Identificador da pessoa",
    fullName: "Nome completo",
    preferredName: "Nome de preferência",
    mobilePhone: "Celular",
    birthDate: "Data de nascimento",
    identityStatus: "Situação da identidade",
    relationships: "Relacionamentos",
    cardStatus: "Situação da carteirinha"
};

/** Tradução de valor enumerado por atributo; devolve o próprio valor se for desconhecido. */
export function enumLabel(attribute: string, value: string): string {
    const table: Record<string, Record<string, string>> = {
        identityStatus: identityStatusLabel,
        cardStatus: cardStatusLabel,
        relationships: relationshipLabel
    };
    return table[attribute]?.[value] ?? value;
}

export const portal = {
    productName: "Comunidade Cairbar",
    organizationName: "CE Cairbar Schutel Guarulhos",
    correctionHint: "Para corrigir, procure a secretaria.",
    genericError: "Não foi possível concluir a operação. Tente novamente em instantes.",
    signOut: "Sair"
} as const;
