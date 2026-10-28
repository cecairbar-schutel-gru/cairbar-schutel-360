package org.cecairbar.keycloak.provisionamento;

import java.util.List;
import org.keycloak.Config;
import org.keycloak.connections.jpa.entityprovider.JpaEntityProvider;
import org.keycloak.connections.jpa.entityprovider.JpaEntityProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

/**
 * Sem entidades: só registra o changelog Liquibase versionado (sequência do personId), aplicado
 * pelo Keycloak na inicialização, junto com as migrações dele.
 */
public class ProvisionamentoJpaEntityProviderFactory implements JpaEntityProviderFactory {

    public static final String ID = "cecairbar-provisionamento";

    @Override
    public JpaEntityProvider create(KeycloakSession session) {
        return new JpaEntityProvider() {
            @Override
            public List<Class<?>> getEntities() {
                return List.of();
            }

            @Override
            public String getChangelogLocation() {
                return "META-INF/cecairbar-changelog.xml";
            }

            @Override
            public String getFactoryId() {
                return ID;
            }

            @Override
            public void close() {
            }
        };
    }

    @Override
    public void init(Config.Scope config) {
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
    }

    @Override
    public void close() {
    }

    @Override
    public String getId() {
        return ID;
    }
}
