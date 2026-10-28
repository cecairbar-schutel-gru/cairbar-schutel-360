package br.cairbar.booksys.keycloak.provisioner;

import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;

/**
 * Leva o realm compartilhado {@code cecairbar} ao estado esperado pela biblioteca: clients, client
 * scope e escopo dos perfis. Realm, perfis, grupos e eventos são do projeto de identidade e não são
 * alterados. É idempotente: cada etapa compara o que existe com o desejado e só cria ou altera o
 * que falta, então pode rodar a cada deploy.
 */
public final class BooksysRealmProvisioner {

    private final Keycloak keycloak;
    private final ProvisionerSettings settings;

    public BooksysRealmProvisioner(Keycloak keycloak, ProvisionerSettings settings) {
        this.keycloak = keycloak;
        this.settings = settings;
    }

    public void provision() {
        RealmResource realm = new RealmPrerequisites(keycloak, settings.realm().name()).require();
        new ApiClientReconciler(settings.realm()).reconcile(realm);
        String apiAccessScopeId = new ApiAccessScopeReconciler().reconcile(realm);
        new WebClientReconciler(settings.realm()).reconcile(realm, apiAccessScopeId);
    }
}
