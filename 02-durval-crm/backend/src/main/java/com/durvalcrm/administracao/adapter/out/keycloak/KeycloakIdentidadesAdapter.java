package com.durvalcrm.administracao.adapter.out.keycloak;

import com.durvalcrm.administracao.application.IdentidadesPort;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Leitura dos usuários do realm pela Admin REST API do Keycloak (US-ADMIN-001), com as credenciais do
 * client confidencial {@code durvalcrm-api} (conta de serviço com {@code view-users},
 * {@code view-clients} e {@code view-events} de {@code realm-management}). Só leitura: nada é criado, alterado ou excluído.
 * Lista quem tem alguma realm role do DurvalCRM, atribuída diretamente ou por grupo (inclusive pelos
 * grupos pai, de que os subgrupos herdam as roles); o último login vem dos eventos de LOGIN (vazio se os
 * eventos do realm estiverem desligados).
 */
@Component
class KeycloakIdentidadesAdapter implements IdentidadesPort {

    private static final Logger LOG = LoggerFactory.getLogger(KeycloakIdentidadesAdapter.class);
    private static final List<String> PAPEIS = List.of("operador", "vendedor", "pdv", "tesoureiro", "administrador");
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LISTA = new ParameterizedTypeReference<>() {
    };

    private final RestClient cliente;
    private final String base;
    private final String realm;
    private final String clientId;
    private final String segredo;
    private final String realmConsole;

    KeycloakIdentidadesAdapter(RestClient.Builder builder,
            @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
            @Value("${durvalcrm.keycloak.client-id:durvalcrm-api}") String clientId,
            @Value("${durvalcrm.keycloak.admin.client-secret:}") String segredo,
            @Value("${durvalcrm.keycloak.admin.console-realm:master}") String realmConsole) {
        int i = issuer.indexOf("/realms/");
        this.base = i < 0 ? issuer : issuer.substring(0, i);
        this.realm = i < 0 ? "" : issuer.substring(i + "/realms/".length()).replaceAll("/+$", "");
        this.clientId = clientId;
        this.segredo = segredo;
        this.realmConsole = realmConsole;
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(Duration.ofSeconds(3));
        fabrica.setReadTimeout(Duration.ofSeconds(10));
        this.cliente = builder.baseUrl(base).requestFactory(fabrica).build();
    }

    @Override
    public boolean configurado() {
        return !segredo.isBlank() && !realm.isBlank();
    }

    @Override
    public List<Identidade> usuarios() {
        String token = token();
        Map<String, Map<String, Object>> usuarios = new LinkedHashMap<>();
        Map<String, Set<String>> papeis = new LinkedHashMap<>();
        for (String papel : PAPEIS) {
            for (Map<String, Object> u : comPapel(papel, token)) {
                String id = String.valueOf(u.get("id"));
                usuarios.putIfAbsent(id, u);
                papeis.computeIfAbsent(id, k -> new LinkedHashSet<>()).add(papel);
            }
        }
        return usuarios.entrySet().stream()
                .map(e -> identidade(e.getValue(), List.copyOf(papeis.get(e.getKey())), token)).toList();
    }

    /** Usuários com a realm role {@code papel}: atribuição direta e membros dos grupos (e subgrupos) que a têm. */
    private List<Map<String, Object>> comPapel(String papel, String token) {
        List<Map<String, Object>> resultado = new ArrayList<>();
        try {
            resultado.addAll(lista(token, "/admin/realms/{realm}/roles/{papel}/users?briefRepresentation=false&max=1000",
                    realm, papel));
            for (Map<String, Object> grupo : lista(token, "/admin/realms/{realm}/roles/{papel}/groups?max=1000", realm, papel)) {
                membros(String.valueOf(grupo.get("id")), token, resultado);
            }
        } catch (HttpClientErrorException.NotFound e) {
            LOG.warn("Realm role {} não encontrada no realm {}.", papel, realm);
        }
        return resultado;
    }

    private void membros(String idGrupo, String token, List<Map<String, Object>> resultado) {
        resultado.addAll(lista(token, "/admin/realms/{realm}/groups/{id}/members?briefRepresentation=false&max=1000",
                realm, idGrupo));
        for (Map<String, Object> filho : lista(token, "/admin/realms/{realm}/groups/{id}/children?max=1000", realm, idGrupo)) {
            membros(String.valueOf(filho.get("id")), token, resultado);
        }
    }

    private List<Map<String, Object>> lista(String token, String uri, Object... variaveis) {
        List<Map<String, Object>> corpo = cliente.get().uri(uri, variaveis)
                .headers(h -> h.setBearerAuth(token)).retrieve().body(LISTA);
        return corpo == null ? List.of() : corpo;
    }

    @Override
    public String linkConsole(String id) {
        return base + "/admin/" + realmConsole + "/console/#/" + realm + "/users/" + id + "/settings";
    }

    private Identidade identidade(Map<String, Object> u, List<String> papeis, String token) {
        String id = String.valueOf(u.get("id"));
        String nome = (texto(u.get("firstName")) + " " + texto(u.get("lastName"))).trim();
        return new Identidade(id, texto(u.get("username")), nome, texto(u.get("email")), papeis,
                !Boolean.FALSE.equals(u.get("enabled")), ultimoLogin(id, token));
    }

    private Instant ultimoLogin(String id, String token) {
        try {
            List<Map<String, Object>> eventos = cliente.get()
                    .uri("/admin/realms/{realm}/events?type=LOGIN&user={id}&max=1", realm, id)
                    .headers(h -> h.setBearerAuth(token)).retrieve().body(LISTA);
            return eventos == null || eventos.isEmpty() || !(eventos.get(0).get("time") instanceof Number n) ? null
                    : Instant.ofEpochMilli(n.longValue());
        } catch (RestClientException e) {
            LOG.debug("Último login indisponível para {}: {}", id, e.getMessage());
            return null;
        }
    }

    private String token() {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        form.add("client_id", clientId);
        form.add("client_secret", segredo);
        Map<String, Object> resposta = cliente.post()
                .uri("/realms/{realm}/protocol/openid-connect/token", realm)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED).body(form).retrieve()
                .body(new ParameterizedTypeReference<Map<String, Object>>() {
                });
        if (resposta == null || resposta.get("access_token") == null) {
            throw new IllegalStateException("O Keycloak não devolveu token para " + clientId + ".");
        }
        return String.valueOf(resposta.get("access_token"));
    }

    private static String texto(Object valor) {
        return valor == null ? "" : String.valueOf(valor);
    }
}
