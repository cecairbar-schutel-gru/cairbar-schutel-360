package com.durvalcrm.shared.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class KeycloakJwtAuthenticationConverterTest {

    private final KeycloakJwtAuthenticationConverter converter = new KeycloakJwtAuthenticationConverter();

    private static Jwt token(Map<String, Object> claims) {
        Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "RS256").subject("a1b2").issuedAt(Instant.now())
                .claim("preferred_username", "mariana.silva");
        claims.forEach(b::claim);
        return b.build();
    }

    @Test
    void mapeiaSoAsRealmRolesDoDurvalcrm() {
        var auth = converter.convert(token(Map.of(
                "realm_access", Map.of("roles", List.of("operador", "vendedor", "schutelista", "bibliotecario",
                        "default-roles-cecairbar", "offline_access")),
                "resource_access", Map.of("durvalcrm-api", Map.of("roles", List.of("administrador"))))));

        assertThat(auth.getAuthorities()).extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("ROLE_OPERADOR", "ROLE_VENDEDOR");
        assertThat(auth.getName()).isEqualTo("mariana.silva");
    }

    @Test
    void semRealmAccessNaoConcedePapel() {
        assertThat(converter.convert(token(Map.of())).getAuthorities()).isEmpty();
    }
}
