package br.cairbar.booksys.keycloak.provisioner;

import static java.lang.System.Logger.Level.INFO;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.resource.ClientScopeResource;
import org.keycloak.admin.client.resource.ProtocolMappersResource;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.RoleScopeResource;
import org.keycloak.admin.client.resource.RolesResource;
import org.keycloak.representations.idm.ClientScopeRepresentation;
import org.keycloak.representations.idm.ProtocolMapperRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;

import jakarta.ws.rs.core.Response;

/**
 * Client scope {@value BooksysClients#API_ACCESS_SCOPE}. Faz o token emitido para a SPA:
 * <ul>
 *   <li>ter {@value BooksysClients#API} no {@code aud}, que o backend valida;</li>
 *   <li>levar só os perfis da biblioteca ({@link LibraryRole}) em {@code realm_access.roles}, já que a
 *       SPA não tem escopo completo ({@code fullScopeAllowed=false}): as roles do DurvalCRM
 *       ({@code vendedor}, {@code tesoureiro}) ficam fora.</li>
 * </ul>
 */
final class ApiAccessScopeReconciler {

    private static final System.Logger LOG = System.getLogger(ApiAccessScopeReconciler.class.getName());

    static final String AUDIENCE_MAPPER = "booksys-api-audience";

    /** @return o id do client scope */
    String reconcile(RealmResource realm) {
        String scopeId = upsertScope(realm);
        ClientScopeResource scope = realm.clientScopes().get(scopeId);
        reconcileAudienceMapper(scope.getProtocolMappers());
        reconcileRoleScope(realm.roles(), scope.getScopeMappings().realmLevel());
        return scopeId;
    }

    private String upsertScope(RealmResource realm) {
        ClientScopeRepresentation scope = realm.clientScopes().findAll().stream()
                .filter(candidate -> BooksysClients.API_ACCESS_SCOPE.equals(candidate.getName()))
                .findFirst()
                .orElse(null);
        boolean exists = scope != null;
        if (!exists) {
            scope = new ClientScopeRepresentation();
            scope.setName(BooksysClients.API_ACCESS_SCOPE);
        }
        scope.setDescription("Audiência e perfis da API da biblioteca");
        scope.setProtocol("openid-connect");
        scope.setAttributes(Map.of(
                "include.in.token.scope", "false",
                "display.on.consent.screen", "false"));
        if (exists) {
            realm.clientScopes().get(scope.getId()).update(scope);
            return scope.getId();
        }
        try (Response response = realm.clientScopes().create(scope)) {
            String id = CreatedResponseUtil.getCreatedId(response);
            LOG.log(INFO, "Client scope {0} criado", BooksysClients.API_ACCESS_SCOPE);
            return id;
        }
    }

    private void reconcileAudienceMapper(ProtocolMappersResource mappers) {
        ProtocolMapperRepresentation desired = new ProtocolMapperRepresentation();
        desired.setName(AUDIENCE_MAPPER);
        desired.setProtocol("openid-connect");
        desired.setProtocolMapper("oidc-audience-mapper");
        desired.setConfig(Map.of(
                "included.client.audience", BooksysClients.API,
                "access.token.claim", "true",
                "introspection.token.claim", "true",
                "id.token.claim", "false",
                "lightweight.claim", "false"));

        ProtocolMapperRepresentation existing = mappers.getMappers().stream()
                .filter(mapper -> AUDIENCE_MAPPER.equals(mapper.getName()))
                .findFirst()
                .orElse(null);
        if (existing == null) {
            try (Response response = mappers.createMapper(desired)) {
                CreatedResponseUtil.getCreatedId(response);
            }
            return;
        }
        desired.setId(existing.getId());
        mappers.update(existing.getId(), desired);
    }

    private void reconcileRoleScope(RolesResource realmRoles, RoleScopeResource scopeMappings) {
        Set<String> current = scopeMappings.listAll().stream()
                .map(RoleRepresentation::getName)
                .collect(Collectors.toSet());
        List<RoleRepresentation> missing = Arrays.stream(LibraryRole.values())
                .map(LibraryRole::roleName)
                .filter(name -> !current.contains(name))
                .map(name -> realmRoles.get(name).toRepresentation())
                .toList();
        if (!missing.isEmpty()) {
            scopeMappings.add(missing);
        }
    }
}
