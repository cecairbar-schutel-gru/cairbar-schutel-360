package com.durvalcrm.shared.security;

import com.durvalcrm.shared.application.CurrentUserPort;
import java.util.Locale;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class SpringSecurityCurrentUserAdapter implements CurrentUserPort {

    @Override
    public String getSubject() {
        return jwt().getSubject();
    }

    @Override
    public String getUsername() {
        return jwt().getClaimAsString("preferred_username");
    }

    @Override
    public String getNome() {
        String nome = jwt().getClaimAsString("name");
        return nome != null && !nome.isBlank() ? nome : getUsername();
    }

    @Override
    public boolean hasRole(String role) {
        String esperado = "ROLE_" + role.toUpperCase(Locale.ROOT);
        return autenticacao().getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(esperado));
    }

    private static Authentication autenticacao() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new IllegalStateException("Nenhum usuário autenticado no contexto.");
        }
        return auth;
    }

    private static Jwt jwt() {
        if (autenticacao().getPrincipal() instanceof Jwt jwt) {
            return jwt;
        }
        throw new IllegalStateException("O principal autenticado não é um JWT.");
    }
}
