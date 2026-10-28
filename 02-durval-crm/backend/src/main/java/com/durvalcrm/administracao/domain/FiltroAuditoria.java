package com.durvalcrm.administracao.domain;

import java.time.Instant;

/** Filtros da tela de auditoria; nulos não filtram. {@code usuario} procura no nome ou no subject. */
public record FiltroAuditoria(Instant de, Instant ate, String usuario, String acao, String entidade,
        String entidadeId) {
}
