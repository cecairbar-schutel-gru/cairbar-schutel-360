package com.durvalcrm.intencaogasto.domain;

import java.time.Instant;
import java.util.Objects;

/** Linha do histórico da intenção: criação, decisões, recebimento, correção e cancelamento. */
public record EventoIntencao(TipoEvento tipo, String usuario, String usuarioNome, Instant em, String descricao) {

    public enum TipoEvento {
        CRIADA,
        APROVADA,
        REJEITADA,
        RETIRADA,
        RECEBIDA,
        DIVERGENTE,
        CORRIGIDA,
        CANCELADA
    }

    public EventoIntencao {
        Objects.requireNonNull(tipo);
        Objects.requireNonNull(usuario);
        Objects.requireNonNull(em);
        Objects.requireNonNull(descricao);
    }
}
