package br.cairbar.booksys.keycloak.provisioner;

import static java.lang.System.Logger.Level.INFO;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.keycloak.admin.client.resource.ClientResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.RoleScopeResource;
import org.keycloak.admin.client.resource.RolesResource;
import org.keycloak.representations.idm.ClientRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;

/**
 * Client {@value BooksysClients#API}: o backend. É a audiência dos tokens e tem a service account
 * que a aplicação usa para gerenciar contas no Keycloak. Os perfis são realm roles
 * ({@link LibraryRole}), não deste client.
 */
final class ApiClientReconciler {

    private static final System.Logger LOG = System.getLogger(ApiClientReconciler.class.getName());

    private final ProvisionerSettings.Realm settings;

    ApiClientReconciler(ProvisionerSettings.Realm settings) {
        this.settings = settings;
    }

    /** @return o id interno (UUID) do client */
    String reconcile(RealmResource realm) {
        String id = Clients.upsert(realm, BooksysClients.API, this::applyDesiredState);
        reconcileServiceAccountRoles(realm, realm.clients().get(id));
        return id;
    }

    private void applyDesiredState(ClientRepresentation client) {
        client.setName("Biblioteca — API");
        client.setDescription("Backend da biblioteca: audiência dos tokens e service account da Admin API");
        client.setProtocol("openid-connect");
        client.setEnabled(true);
        client.setPublicClient(false);
        client.setBearerOnly(false);
        client.setClientAuthenticatorType("client-secret");
        settings.apiClientSecret().ifPresent(client::setSecret);
        // Nenhum usuário faz login por este client: só client_credentials da service account.
        client.setStandardFlowEnabled(false);
        client.setImplicitFlowEnabled(false);
        client.setDirectAccessGrantsEnabled(false);
        client.setServiceAccountsEnabled(true);
        client.setConsentRequired(false);
        // A Admin API exige que as roles de realm-management estejam no escopo do token da service account.
        client.setFullScopeAllowed(true);
        Clients.putAttributes(client, Map.of(
                "oauth2.device.authorization.grant.enabled", "false",
                "oidc.ciba.grant.enabled", "false"));
    }

    private void reconcileServiceAccountRoles(RealmResource realm, ClientResource client) {
        String serviceAccountId = client.getServiceAccountUser().getId();
        String realmManagementId = Clients.idOf(realm, "realm-management");
        RoleScopeResource mapped = realm.users().get(serviceAccountId).roles().clientLevel(realmManagementId);
        Set<String> current = mapped.listAll().stream()
                .map(RoleRepresentation::getName)
                .collect(Collectors.toSet());
        RolesResource realmManagementRoles = realm.clients().get(realmManagementId).roles();
        List<RoleRepresentation> missing = BooksysClients.API_SERVICE_ACCOUNT_ROLES.stream()
                .filter(name -> !current.contains(name))
                .map(name -> realmManagementRoles.get(name).toRepresentation())
                .toList();
        if (!missing.isEmpty()) {
            mapped.add(missing);
            LOG.log(INFO, "Service account de {0} recebeu {1}", BooksysClients.API,
                    missing.stream().map(RoleRepresentation::getName).toList());
        }
    }
}
