package br.cairbar.booksys.keycloak.provisioner;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.keycloak.admin.client.resource.ClientResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.representations.idm.ClientRepresentation;

/**
 * Client {@value BooksysClients#WEB}: a SPA React. Client público com Authorization Code + PKCE,
 * sem segredo no navegador (US-IDE-02).
 */
final class WebClientReconciler {

    private final ProvisionerSettings.Realm settings;

    WebClientReconciler(ProvisionerSettings.Realm settings) {
        this.settings = settings;
    }

    /** @return o id interno (UUID) do client */
    String reconcile(RealmResource realm, String apiAccessScopeId) {
        String id = Clients.upsert(realm, BooksysClients.WEB, this::applyDesiredState);
        ClientResource client = realm.clients().get(id);
        boolean linked = client.getDefaultClientScopes().stream()
                .anyMatch(scope -> scope.getId().equals(apiAccessScopeId));
        if (!linked) {
            client.addDefaultClientScope(apiAccessScopeId);
        }
        return id;
    }

    private void applyDesiredState(ClientRepresentation client) {
        List<URI> urls = settings.webUrls();
        // "/*" permite voltar à página de origem após o login (US-IDE-02 "Login exigido em ação protegida").
        List<String> appPaths = urls.stream().map(url -> url + "/*").toList();

        client.setName("Biblioteca — aplicação web");
        client.setDescription("SPA React da biblioteca (Authorization Code + PKCE)");
        client.setProtocol("openid-connect");
        client.setEnabled(true);
        client.setPublicClient(true);
        client.setStandardFlowEnabled(true);
        client.setImplicitFlowEnabled(false);
        client.setDirectAccessGrantsEnabled(false);
        client.setServiceAccountsEnabled(false);
        client.setConsentRequired(false);
        client.setFrontchannelLogout(true);
        // Só os perfis liberados pelo client scope booksys-api-access entram no token.
        client.setFullScopeAllowed(false);
        client.setRootUrl(urls.getFirst().toString());
        client.setBaseUrl("/");
        client.setRedirectUris(appPaths);
        client.setWebOrigins(urls.stream().map(URI::toString).toList());
        Clients.putAttributes(client, Map.of(
                "pkce.code.challenge.method", "S256",
                // US-IDE-02 "Logout": logout iniciado pela SPA encerra a sessão no Keycloak e volta à aplicação.
                "post.logout.redirect.uris", appPaths.stream().collect(Collectors.joining("##")),
                "oauth2.device.authorization.grant.enabled", "false",
                "oidc.ciba.grant.enabled", "false"));
    }
}
