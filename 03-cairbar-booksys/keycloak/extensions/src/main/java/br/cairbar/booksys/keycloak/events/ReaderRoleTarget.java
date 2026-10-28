package br.cairbar.booksys.keycloak.events;

/**
 * Client e perfil concedidos pelo {@link ReaderRoleGrantEventListener}.
 * Os valores padrão são os mesmos criados pelo provisionador.
 */
record ReaderRoleTarget(String clientId, String roleName) {

    static final String DEFAULT_CLIENT_ID = "booksys-api";
    static final String DEFAULT_ROLE_NAME = "READER";

    ReaderRoleTarget {
        if (clientId == null || clientId.isBlank()) {
            throw new IllegalArgumentException("clientId é obrigatório");
        }
        if (roleName == null || roleName.isBlank()) {
            throw new IllegalArgumentException("roleName é obrigatório");
        }
    }
}
