package br.cairbar.booksys.keycloak.provisioner;

import static java.lang.System.Logger.Level.INFO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

import org.keycloak.admin.client.CreatedResponseUtil;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.representations.idm.ClientRepresentation;

import jakarta.ws.rs.core.Response;

/** Cria ou atualiza clients pelo {@code clientId}, preservando o que não faz parte do estado desejado. */
final class Clients {

    private static final System.Logger LOG = System.getLogger(Clients.class.getName());

    private Clients() {
    }

    /** @return o id interno (UUID) do client */
    static String upsert(RealmResource realm, String clientId, Consumer<ClientRepresentation> desiredState) {
        List<ClientRepresentation> found = realm.clients().findByClientId(clientId);
        if (found.isEmpty()) {
            ClientRepresentation client = new ClientRepresentation();
            client.setClientId(clientId);
            desiredState.accept(client);
            try (Response response = realm.clients().create(client)) {
                String id = CreatedResponseUtil.getCreatedId(response);
                LOG.log(INFO, "Client {0} criado", clientId);
                return id;
            }
        }
        ClientRepresentation client = found.getFirst();
        desiredState.accept(client);
        realm.clients().get(client.getId()).update(client);
        LOG.log(INFO, "Client {0} atualizado", clientId);
        return client.getId();
    }

    static String idOf(RealmResource realm, String clientId) {
        return realm.clients().findByClientId(clientId).stream()
                .findFirst()
                .map(ClientRepresentation::getId)
                .orElseThrow(() -> new ProvisioningException("Client " + clientId + " não encontrado"));
    }

    static void putAttributes(ClientRepresentation client, Map<String, String> desired) {
        Map<String, String> attributes = new HashMap<>(Optional.ofNullable(client.getAttributes()).orElse(Map.of()));
        attributes.putAll(desired);
        client.setAttributes(attributes);
    }
}
