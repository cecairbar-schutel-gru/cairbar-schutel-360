package br.cairbar.booksys.keycloak.provisioner;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Configuração do provisionamento, lida de variáveis de ambiente para que os segredos venham
 * do vault (ansible) ou do arquivo {@code .env} local, nunca do código.
 */
public record ProvisionerSettings(AdminConnection admin, Realm realm) {

    /** Credenciais de um administrador do Keycloak (realm {@code master}) usadas só pelo provisionador. */
    public record AdminConnection(
            String serverUrl,
            String realm,
            String clientId,
            Optional<String> clientSecret,
            Optional<String> username,
            Optional<String> password) {

        public AdminConnection {
            if (clientSecret.isEmpty() && (username.isEmpty() || password.isEmpty())) {
                throw new IllegalArgumentException(
                        "Informe KEYCLOAK_ADMIN_CLIENT_SECRET ou KEYCLOAK_ADMIN_USERNAME e KEYCLOAK_ADMIN_PASSWORD");
            }
        }
    }

    /**
     * Realm compartilhado da organização ({@code cecairbar}). Configuração do realm, perfis, grupos,
     * SMTP, eventos e administradores ficam com o projeto de identidade ({@code 01-cairbar-identity-provider}).
     */
    public record Realm(String name, List<URI> webUrls, Optional<String> apiClientSecret) {

        public Realm {
            if (webUrls.isEmpty()) {
                throw new IllegalArgumentException("BOOKSYS_WEB_URLS precisa de ao menos uma URL");
            }
            webUrls = List.copyOf(webUrls);
        }
    }

    public static ProvisionerSettings fromEnvironment(Map<String, String> env) {
        Environment e = new Environment(env);

        AdminConnection admin = new AdminConnection(
                e.required("KEYCLOAK_URL"),
                e.optional("KEYCLOAK_ADMIN_REALM").orElse("master"),
                e.optional("KEYCLOAK_ADMIN_CLIENT_ID").orElse("admin-cli"),
                e.optional("KEYCLOAK_ADMIN_CLIENT_SECRET"),
                e.optional("KEYCLOAK_ADMIN_USERNAME"),
                e.optional("KEYCLOAK_ADMIN_PASSWORD"));

        Realm realm = new Realm(
                e.optional("BOOKSYS_REALM").orElse("cecairbar"),
                e.uris("BOOKSYS_WEB_URLS"),
                e.optional("BOOKSYS_API_CLIENT_SECRET"));

        return new ProvisionerSettings(admin, realm);
    }

    private record Environment(Map<String, String> values) {

        Optional<String> optional(String name) {
            return Optional.ofNullable(values.get(name)).map(String::strip).filter(v -> !v.isEmpty());
        }

        String required(String name) {
            return optional(name).orElseThrow(
                    () -> new IllegalArgumentException("Variável de ambiente obrigatória ausente: " + name));
        }

        List<URI> uris(String name) {
            return Arrays.stream(required(name).split(","))
                    .map(String::strip)
                    .filter(v -> !v.isEmpty())
                    .map(v -> URI.create(v.endsWith("/") ? v.substring(0, v.length() - 1) : v))
                    .toList();
        }
    }
}
