package br.cairbar.booksys.keycloak.provisioner;

import java.util.List;

/** Identificadores fixos que a aplicação e a extensão SPI também conhecem. */
public final class BooksysClients {

    /** SPA React: client público com Authorization Code + PKCE. */
    public static final String WEB = "booksys-web";

    /** Backend Spring Boot: audiência dos tokens e service account da Admin API. */
    public static final String API = "booksys-api";

    /** Client scope que coloca {@link #API} no {@code aud} e libera os perfis ({@link LibraryRole}) no token do {@link #WEB}. */
    public static final String API_ACCESS_SCOPE = "booksys-api-access";

    /**
     * Roles do client {@code realm-management} para o backend gerenciar contas pela Admin API:
     * criar leitores (US-IDE-01/03), sincronizar nome e e-mail (US-IDE-04), desativar contas
     * (US-IDE-11/12), atribuir perfis incluindo a pessoa no grupo do perfil (US-IDE-12) e enviar e-mails de ação.
     */
    public static final List<String> API_SERVICE_ACCOUNT_ROLES =
            List.of("manage-users", "view-users", "query-users", "query-groups", "view-clients");

    private BooksysClients() {
    }
}
