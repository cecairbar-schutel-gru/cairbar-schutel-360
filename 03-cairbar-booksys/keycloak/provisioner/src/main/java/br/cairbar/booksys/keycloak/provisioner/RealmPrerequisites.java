package br.cairbar.booksys.keycloak.provisioner;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.representations.idm.RoleRepresentation;

import jakarta.ws.rs.NotFoundException;

/**
 * O realm e os perfis pertencem ao projeto de identidade ({@code 01-cairbar-identity-provider},
 * playbook {@code keycloak-realm.yml}). O provisionador nunca os cria: falha antes de alterar
 * qualquer coisa se eles ainda não existirem.
 */
final class RealmPrerequisites {

    private final Keycloak keycloak;
    private final String realmName;

    RealmPrerequisites(Keycloak keycloak, String realmName) {
        this.keycloak = keycloak;
        this.realmName = realmName;
    }

    RealmResource require() {
        RealmResource realm = keycloak.realm(realmName);
        try {
            realm.toRepresentation();
        } catch (NotFoundException e) {
            throw new ProvisioningException("Realm " + realmName + " não existe. Rode antes o keycloak-realm.yml "
                    + "de 01-cairbar-identity-provider.");
        }
        Set<String> existing = realm.roles().list().stream()
                .map(RoleRepresentation::getName)
                .collect(Collectors.toSet());
        List<String> missing = Arrays.stream(LibraryRole.values())
                .map(LibraryRole::roleName)
                .filter(name -> !existing.contains(name))
                .toList();
        if (!missing.isEmpty()) {
            throw new ProvisioningException("Realm roles ausentes em " + realmName + ": " + missing
                    + ". Rode antes o keycloak-realm.yml de 01-cairbar-identity-provider.");
        }
        return realm;
    }
}
