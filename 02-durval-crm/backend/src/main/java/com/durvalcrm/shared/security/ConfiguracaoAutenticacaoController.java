package com.durvalcrm.shared.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Configuração pública do login do SPA (sem autenticação): o frontend embutido no WAR descobre o
 * realm e o client público aqui, de modo que o mesmo build vale para todo ambiente.
 */
@RestController
@RequestMapping("/api/publico")
class ConfiguracaoAutenticacaoController {

    private static final String REALMS = "/realms/";

    private final ConfiguracaoAutenticacao configuracao;

    ConfiguracaoAutenticacaoController(@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer,
            @Value("${durvalcrm.keycloak.web-client-id:durvalcrm-web}") String clientIdWeb,
            @Value("${durvalcrm.keycloak.client-id:durvalcrm-api}") String clientIdApi) {
        this.configuracao = deIssuer(issuer, clientIdWeb, clientIdApi);
    }

    @GetMapping("/configuracao-autenticacao")
    ConfiguracaoAutenticacao configuracao() {
        return configuracao;
    }

    /** {@code https://<host>/realms/<realm>} → URL base do Keycloak e nome do realm. */
    static ConfiguracaoAutenticacao deIssuer(String issuer, String clientIdWeb, String clientIdApi) {
        String semBarra = issuer.endsWith("/") ? issuer.substring(0, issuer.length() - 1) : issuer;
        int inicio = semBarra.lastIndexOf(REALMS);
        if (inicio < 0 || inicio + REALMS.length() == semBarra.length()) {
            throw new IllegalStateException("Issuer do Keycloak sem /realms/<realm>: " + issuer);
        }
        return new ConfiguracaoAutenticacao(semBarra.substring(0, inicio), semBarra.substring(inicio + REALMS.length()),
                clientIdWeb, clientIdApi);
    }

    record ConfiguracaoAutenticacao(String url, String realm, String clientId, String clientIdApi) {
    }
}
