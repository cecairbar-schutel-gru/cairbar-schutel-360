package com.durvalcrm.administracao.domain;

import java.time.Instant;
import java.util.Map;

/**
 * Registro imutável de quem fez o quê, quando e com quais valores (US-ADMIN-009): perfil em uso e IP
 * da requisição; valores anteriores e novos e o motivo ficam em {@code detalhes}.
 */
public record EventoAuditoria(
        Long id,
        Instant em,
        String autorSubject,
        String autorNome,
        String perfil,
        String ip,
        String acao,
        String entidade,
        String entidadeId,
        Map<String, Object> detalhes) {

    public EventoAuditoria {
        detalhes = detalhes == null ? Map.of() : detalhes;
    }

    /** Mesmo registro sem os valores (doador anonimizado: os dados pessoais não são mostrados). */
    public EventoAuditoria semDetalhes() {
        return new EventoAuditoria(id, em, autorSubject, autorNome, perfil, ip, acao, entidade, entidadeId, Map.of());
    }
}
