package br.cairbar.booksys.keycloak.provisioner;

import static java.lang.System.Logger.Level.ERROR;
import static java.lang.System.Logger.Level.INFO;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;

import jakarta.ws.rs.WebApplicationException;

/** Ponto de entrada: {@code java -jar booksys-keycloak-provisioner-all.jar}. */
public final class ProvisionerApplication {

    private ProvisionerApplication() {
    }

    public static void main(String[] args) {
        System.setProperty("java.util.logging.SimpleFormatter.format", "%1$tFT%1$tT %4$s %5$s%6$s%n");
        System.Logger log = System.getLogger(ProvisionerApplication.class.getName());
        try {
            ProvisionerSettings settings = ProvisionerSettings.fromEnvironment(System.getenv());
            try (Keycloak keycloak = connect(settings.admin())) {
                new BooksysRealmProvisioner(keycloak, settings).provision();
            }
            log.log(INFO, "Provisionamento do realm {0} concluído", settings.realm().name());
        } catch (IllegalArgumentException | ProvisioningException e) {
            log.log(ERROR, e.getMessage());
            System.exit(2);
        } catch (WebApplicationException e) {
            log.log(ERROR, "Keycloak recusou a operação: HTTP {0} {1}",
                    e.getResponse().getStatus(), e.getResponse().readEntity(String.class));
            System.exit(1);
        }
    }

    static Keycloak connect(ProvisionerSettings.AdminConnection admin) {
        KeycloakBuilder builder = KeycloakBuilder.builder()
                .serverUrl(admin.serverUrl())
                .realm(admin.realm())
                .clientId(admin.clientId());
        if (admin.clientSecret().isPresent()) {
            return builder.grantType("client_credentials")
                    .clientSecret(admin.clientSecret().get())
                    .build();
        }
        return builder.grantType("password")
                .username(admin.username().orElseThrow())
                .password(admin.password().orElseThrow())
                .build();
    }
}
