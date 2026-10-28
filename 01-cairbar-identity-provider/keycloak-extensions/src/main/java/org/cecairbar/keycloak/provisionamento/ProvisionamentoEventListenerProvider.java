package org.cecairbar.keycloak.provisionamento;

import jakarta.persistence.EntityManager;
import org.jboss.logging.Logger;
import org.keycloak.connections.jpa.JpaConnectionProvider;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;

/**
 * Provisiona a pessoa na criação do usuário, na mesma transação da requisição: autocadastro
 * (evento REGISTER) e criação pela Admin API (evento administrativo CREATE de users/{id}).
 * Só roda nos realms que listam o listener em eventsListeners (realm/cecairbar.yml).
 */
public class ProvisionamentoEventListenerProvider implements EventListenerProvider {

    private static final Logger LOG = Logger.getLogger(ProvisionamentoEventListenerProvider.class);
    private static final String SEQUENCIA = "SELECT nextval('cecairbar_person_id_seq')";

    private final KeycloakSession session;

    public ProvisionamentoEventListenerProvider(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public void onEvent(Event event) {
        if (event.getType() == EventType.REGISTER && event.getUserId() != null) {
            provisionar(event.getRealmId(), event.getUserId(), true);
        }
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        if (event.getResourceType() == ResourceType.USER && event.getOperationType() == OperationType.CREATE) {
            String userId = userIdDoRecurso(event.getResourcePath());
            if (userId != null) {
                provisionar(event.getRealmId(), userId, false);
            }
        }
    }

    /** "users/{id}" -> id; outros recursos (ex.: users/{id}/groups/...) -> null. */
    static String userIdDoRecurso(String resourcePath) {
        if (resourcePath == null || !resourcePath.startsWith("users/")) {
            return null;
        }
        String id = resourcePath.substring("users/".length());
        return id.isEmpty() || id.contains("/") ? null : id;
    }

    private void provisionar(String realmId, String userId, boolean autocadastro) {
        RealmModel realm = session.realms().getRealm(realmId);
        UserModel usuario = realm == null ? null : session.users().getUserById(realm, userId);
        if (usuario == null) {
            // Sem PII no log: só o id interno do Keycloak.
            LOG.warnf("Usuário %s não encontrado para provisionamento", userId);
            return;
        }
        EntityManager em = session.getProvider(JpaConnectionProvider.class).getEntityManager();
        ProvisionamentoPessoa provisionamento = new ProvisionamentoPessoa(
                () -> ((Number) em.createNativeQuery(SEQUENCIA).getSingleResult()).longValue(),
                personId -> session.users()
                        .searchForUserByUserAttributeStream(realm, ProvisionamentoPessoa.PERSON_ID, personId)
                        .anyMatch(outro -> !outro.getId().equals(userId)));
        provisionamento.provisionar(usuario, autocadastro);
        LOG.infof("Usuário %s provisionado (autocadastro=%s)", userId, autocadastro);
    }

    @Override
    public void close() {
    }
}
