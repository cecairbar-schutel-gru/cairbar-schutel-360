package br.cairbar.booksys.keycloak;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.ClientResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.representations.AccessToken;
import org.keycloak.representations.idm.ClientRepresentation;
import org.keycloak.representations.idm.RealmRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;

import br.cairbar.booksys.keycloak.provisioner.BooksysClients;
import br.cairbar.booksys.keycloak.provisioner.BooksysRealmProvisioner;
import br.cairbar.booksys.keycloak.provisioner.ProvisionerSettings;
import br.cairbar.booksys.keycloak.provisioner.ProvisioningException;
import dasniko.testcontainers.keycloak.KeycloakContainer;
import jakarta.ws.rs.core.Response;

class BooksysRealmProvisionerIT {

    private static final String REALM = "cecairbar";

    /** Realm roles que o projeto de identidade cria: as da biblioteca e as do DurvalCRM. */
    private static final List<String> REALM_ROLES =
            List.of("schutelista", "operador", "bibliotecario", "administrador", "vendedor", "tesoureiro");

    private static final KeycloakContainer KEYCLOAK = new KeycloakContainer("quay.io/keycloak/keycloak:26.8.1");

    private static Keycloak admin;
    private static ProvisionerSettings settings;
    private static RealmResource realm;

    @BeforeAll
    static void provision() {
        KEYCLOAK.start();
        admin = KEYCLOAK.getKeycloakAdminClient();
        // Estado deixado pelo keycloak-realm.yml de 01-cairbar-identity-provider.
        createRealm(REALM, REALM_ROLES);
        settings = settings(REALM);

        new BooksysRealmProvisioner(admin, settings).provision();
        realm = admin.realm(REALM);
    }

    @AfterAll
    static void stop() {
        if (admin != null) {
            admin.close();
        }
        KEYCLOAK.stop();
    }

    @Test
    void provisioningIsIdempotentAndNeverCreatesRoles() {
        assertThatCode(() -> new BooksysRealmProvisioner(admin, settings).provision()).doesNotThrowAnyException();

        assertThat(realm.clients().findByClientId(BooksysClients.WEB)).hasSize(1);
        assertThat(realm.clients().findByClientId(BooksysClients.API)).hasSize(1);
        assertThat(realm.clientScopes().findAll())
                .filteredOn(scope -> BooksysClients.API_ACCESS_SCOPE.equals(scope.getName()))
                .hasSize(1);
        assertThat(api().roles().list()).isEmpty();
        assertThat(realm.roles().list()).extracting(RoleRepresentation::getName)
                .filteredOn(REALM_ROLES::contains)
                .containsExactlyInAnyOrderElementsOf(REALM_ROLES);
    }

    @Test
    void failsBeforeChangingAnythingWhenTheProfilesAreMissing() {
        createRealm("sem-perfis", List.of("operador"));

        assertThatThrownBy(() -> new BooksysRealmProvisioner(admin, settings("sem-perfis")).provision())
                .isInstanceOf(ProvisioningException.class)
                .hasMessageContaining("schutelista")
                .hasMessageContaining("bibliotecario");
        assertThat(admin.realm("sem-perfis").clients().findByClientId(BooksysClients.WEB)).isEmpty();
    }

    @Test
    void failsWhenTheRealmDoesNotExist() {
        assertThatThrownBy(() -> new BooksysRealmProvisioner(admin, settings("inexistente")).provision())
                .isInstanceOf(ProvisioningException.class)
                .hasMessageContaining("inexistente");
    }

    @Test
    void webClientIsPublicAndUsesPkce() {
        ClientRepresentation web = realm.clients().findByClientId(BooksysClients.WEB).getFirst();

        assertThat(web.isPublicClient()).isTrue();
        assertThat(web.isStandardFlowEnabled()).isTrue();
        assertThat(web.isImplicitFlowEnabled()).isFalse();
        assertThat(web.isDirectAccessGrantsEnabled()).isFalse();
        assertThat(web.isFullScopeAllowed()).isFalse();
        assertThat(web.getRedirectUris())
                .containsExactlyInAnyOrder("https://biblioteca.example/*", "http://localhost:5173/*");
        assertThat(web.getAttributes())
                .containsEntry("pkce.code.challenge.method", "S256")
                .containsEntry("post.logout.redirect.uris", "https://biblioteca.example/*##http://localhost:5173/*");
    }

    @Test
    void apiClientIsConfidentialAndManagesAccountsThroughItsServiceAccount() {
        ClientResource api = api();
        ClientRepresentation representation = api.toRepresentation();

        assertThat(representation.isPublicClient()).isFalse();
        assertThat(representation.isStandardFlowEnabled()).isFalse();
        assertThat(representation.isServiceAccountsEnabled()).isTrue();
        assertThat(api.getSecret().getValue()).isEqualTo("api-secret");

        String serviceAccountId = api.getServiceAccountUser().getId();
        String realmManagementId = realm.clients().findByClientId("realm-management").getFirst().getId();
        assertThat(realm.users().get(serviceAccountId).roles().clientLevel(realmManagementId).listAll())
                .extracting(RoleRepresentation::getName)
                .containsExactlyInAnyOrderElementsOf(BooksysClients.API_SERVICE_ACCOUNT_ROLES);
    }

    @Test
    void webTokenCarriesApiAudienceAndOnlyTheLibraryProfiles() {
        String userId = createUser("bibliotecaria@biblioteca.example", List.of("schutelista", "bibliotecario", "vendedor"));
        String webId = realm.clients().findByClientId(BooksysClients.WEB).getFirst().getId();

        AccessToken token = realm.clients().get(webId).clientScopesEvaluate()
                .generateAccessToken("openid", userId, null);

        assertThat(token.getAudience()).contains(BooksysClients.API);
        // vendedor é perfil do DurvalCRM: fica fora do token da biblioteca.
        assertThat(token.getRealmAccess().getRoles())
                .containsExactlyInAnyOrder("schutelista", "bibliotecario");
    }

    private static ProvisionerSettings settings(String realmName) {
        Map<String, String> env = new HashMap<>();
        env.put("KEYCLOAK_URL", KEYCLOAK.getAuthServerUrl());
        env.put("KEYCLOAK_ADMIN_USERNAME", KEYCLOAK.getAdminUsername());
        env.put("KEYCLOAK_ADMIN_PASSWORD", KEYCLOAK.getAdminPassword());
        env.put("BOOKSYS_REALM", realmName);
        env.put("BOOKSYS_WEB_URLS", "https://biblioteca.example,http://localhost:5173");
        env.put("BOOKSYS_API_CLIENT_SECRET", "api-secret");
        return ProvisionerSettings.fromEnvironment(env);
    }

    private static void createRealm(String name, List<String> roles) {
        RealmRepresentation representation = new RealmRepresentation();
        representation.setRealm(name);
        representation.setEnabled(true);
        admin.realms().create(representation);
        for (String role : roles) {
            admin.realm(name).roles().create(new RoleRepresentation(role, null, false));
        }
    }

    private static ClientResource api() {
        return realm.clients().get(realm.clients().findByClientId(BooksysClients.API).getFirst().getId());
    }

    private static String createUser(String email, List<String> roles) {
        UserRepresentation user = new UserRepresentation();
        user.setUsername(email);
        user.setEmail(email);
        user.setFirstName("Maria");
        user.setLastName("Bibliotecária");
        user.setEnabled(true);
        user.setEmailVerified(true);
        String id;
        try (Response response = realm.users().create(user)) {
            id = CreatedResponseUtil.getCreatedId(response);
        }
        realm.users().get(id).roles().realmLevel()
                .add(roles.stream().map(role -> realm.roles().get(role).toRepresentation()).toList());
        return id;
    }
}
