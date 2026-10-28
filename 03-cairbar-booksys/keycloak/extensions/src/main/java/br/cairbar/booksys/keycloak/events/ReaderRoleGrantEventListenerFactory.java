package br.cairbar.booksys.keycloak.events;

import java.util.List;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderConfigurationBuilder;

/**
 * Registra o listener {@value #PROVIDER_ID}. Ele só atua nos realms que o incluem em
 * "Event listeners", o que o provisionador faz no realm da biblioteca.
 *
 * <p>Opções do SPI {@code events-listener} (ex.: {@code --spi-events-listener--booksys-reader-role--client-id}):
 * {@code client-id} (padrão {@code booksys-api}) e {@code role} (padrão {@code READER}).
 */
public final class ReaderRoleGrantEventListenerFactory implements EventListenerProviderFactory {

    public static final String PROVIDER_ID = "booksys-reader-role";

    private ReaderRoleTarget target;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new ReaderRoleGrantEventListener(session, target);
    }

    @Override
    public void init(Config.Scope config) {
        target = new ReaderRoleTarget(
                config.get("client-id", ReaderRoleTarget.DEFAULT_CLIENT_ID),
                config.get("role", ReaderRoleTarget.DEFAULT_ROLE_NAME));
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
    }

    @Override
    public List<ProviderConfigProperty> getConfigMetadata() {
        return ProviderConfigurationBuilder.create()
                .property().name("client-id").type(ProviderConfigProperty.STRING_TYPE)
                .helpText("Client que define o perfil de leitor").defaultValue(ReaderRoleTarget.DEFAULT_CLIENT_ID).add()
                .property().name("role").type(ProviderConfigProperty.STRING_TYPE)
                .helpText("Perfil concedido após a validação do e-mail").defaultValue(ReaderRoleTarget.DEFAULT_ROLE_NAME).add()
                .build();
    }

    @Override
    public void close() {
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}
