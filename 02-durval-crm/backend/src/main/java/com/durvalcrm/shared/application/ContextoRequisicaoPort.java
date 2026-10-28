package com.durvalcrm.shared.application;

/** Dados da requisição em curso registrados na auditoria (US-ADMIN-009); nulos fora de uma requisição. */
public interface ContextoRequisicaoPort {

    /** Perfil em uso escolhido no seletor do frontend, se o usuário tiver esse papel. */
    String perfil();

    String ip();
}
