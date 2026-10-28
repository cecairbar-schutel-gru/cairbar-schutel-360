package com.durvalcrm.shared.application;

/** Usuário autenticado, sem expor Keycloak nem Spring Security aos casos de uso. */
public interface CurrentUserPort {

    /** Claim {@code sub} do token, que liga o usuário do DurvalCRM ao Keycloak. */
    String getSubject();

    String getUsername();

    /** Nome para exibição (autor de notas e auditoria). */
    String getNome();

    boolean hasRole(String role);
}
