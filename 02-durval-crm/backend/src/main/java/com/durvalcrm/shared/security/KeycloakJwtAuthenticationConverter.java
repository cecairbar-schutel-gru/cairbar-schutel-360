package com.durvalcrm.shared.security;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Mapeia as realm roles do DurvalCRM em {@code realm_access.roles} (atribuídas pelos grupos do realm
 * cecairbar) para authorities {@code ROLE_OPERADOR}, {@code ROLE_ADMINISTRADOR} etc. As demais realm
 * roles (schutelista e perfis do SGB, default-roles, offline_access) e as client roles são ignoradas.
 * TODO(US-ACTIVITY): mapear schutelista quando o agendamento de atividades existir.
 */
@Component
public class KeycloakJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    static final Set<String> PAPEIS = Set.of("operador", "vendedor", "pdv", "tesoureiro", "administrador");

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, authorities(jwt), jwt.getClaimAsString("preferred_username"));
    }

    private Collection<GrantedAuthority> authorities(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null || !(realmAccess.get("roles") instanceof Collection<?> roles)) {
            return List.of();
        }
        return roles.stream()
                .filter(r -> PAPEIS.contains(r.toString()))
                .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r.toString().toUpperCase(Locale.ROOT)))
                .toList();
    }
}
