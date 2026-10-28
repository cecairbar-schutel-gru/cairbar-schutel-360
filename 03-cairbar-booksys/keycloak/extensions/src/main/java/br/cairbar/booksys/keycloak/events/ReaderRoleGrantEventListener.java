package br.cairbar.booksys.keycloak.events;

import java.util.EnumSet;
import java.util.Set;

import org.jboss.logging.Logger;
import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.ClientModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.RoleModel;
import org.keycloak.models.UserModel;

/**
 * Concede o perfil Leitor somente depois que o e-mail da conta foi validado
 * (RN-01, US-IDE-01 "Validação do e-mail": a conta passa a Ativa e recebe o perfil Leitor).
 *
 * <p>O gatilho principal é {@link EventType#VERIFY_EMAIL}. O {@link EventType#LOGIN} cobre as
 * contas validadas por outros caminhos (link de "executar ações" enviado pelo operador ou pela
 * migração, US-IDE-03 e US-IDE-10), já que o usuário precisa autenticar para usar a aplicação.
 * O evento roda na mesma transação da requisição, então o primeiro token emitido já traz o perfil.
 */
public final class ReaderRoleGrantEventListener implements EventListenerProvider {

    private static final Logger LOG = Logger.getLogger(ReaderRoleGrantEventListener.class);

    private static final Set<EventType> TRIGGERS = EnumSet.of(EventType.VERIFY_EMAIL, EventType.LOGIN);

    private final KeycloakSession session;
    private final ReaderRoleTarget target;

    ReaderRoleGrantEventListener(KeycloakSession session, ReaderRoleTarget target) {
        this.session = session;
        this.target = target;
    }

    @Override
    public void onEvent(Event event) {
        if (!TRIGGERS.contains(event.getType()) || event.getUserId() == null) {
            return;
        }
        RealmModel realm = session.realms().getRealm(event.getRealmId());
        if (realm == null) {
            return;
        }
        UserModel user = session.users().getUserById(realm, event.getUserId());
        if (user == null || !user.isEnabled() || !user.isEmailVerified()) {
            return;
        }
        RoleModel readerRole = findReaderRole(realm);
        if (readerRole == null || user.hasDirectRole(readerRole)) {
            return;
        }
        user.grantRole(readerRole);
        // Apenas o id opaco do Keycloak: nenhum dado pessoal nos logs.
        LOG.infof("Perfil %s concedido ao usuário %s no realm %s após validação de e-mail",
                readerRole.getName(), user.getId(), realm.getName());
    }

    private RoleModel findReaderRole(RealmModel realm) {
        ClientModel client = realm.getClientByClientId(target.clientId());
        if (client == null) {
            LOG.warnf("Client %s não existe no realm %s; perfil Leitor não concedido",
                    target.clientId(), realm.getName());
            return null;
        }
        RoleModel role = client.getRole(target.roleName());
        if (role == null) {
            LOG.warnf("Perfil %s não existe no client %s do realm %s; perfil Leitor não concedido",
                    target.roleName(), target.clientId(), realm.getName());
        }
        return role;
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        // Alterações administrativas não concedem o perfil: a validação é feita pelo próprio leitor.
    }

    @Override
    public void close() {
    }
}
