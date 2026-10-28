package com.durvalcrm.estoque.domain;

import java.time.Instant;
import java.util.Objects;

/**
 * Toda mudança de saldo; positiva entra, negativa sai. Nunca editado nem excluído: a correção é um
 * movimento {@link TipoMovimento#ESTORNO} que aponta o original.
 */
public record MovimentoEstoque(Long id, long produtoId, Long remessaId, TipoMovimento tipo, int quantidade,
        Instant ocorridoEm, String usuarioSubject, String usuarioNome, String referenciaTipo, Long referenciaId,
        Long estornaMovimentoId) {

    public MovimentoEstoque {
        Objects.requireNonNull(tipo);
        Objects.requireNonNull(ocorridoEm);
        Objects.requireNonNull(usuarioSubject);
        if (quantidade == 0) {
            throw new IllegalArgumentException("Movimento sem quantidade.");
        }
    }

    public static MovimentoEstoque novo(long produtoId, Long remessaId, TipoMovimento tipo, int quantidade,
            Instant em, String usuarioSubject, String usuarioNome, String referenciaTipo, Long referenciaId) {
        return new MovimentoEstoque(null, produtoId, remessaId, tipo, quantidade, em, usuarioSubject, usuarioNome,
                referenciaTipo, referenciaId, null);
    }

    /** Movimento que reverte este, no mesmo lote e com a mesma referência. */
    public MovimentoEstoque estorno(Instant em, String usuarioSubject, String usuarioNome) {
        if (id == null) {
            throw new IllegalStateException("Só um movimento registrado pode ser estornado.");
        }
        if (tipo == TipoMovimento.ESTORNO) {
            throw new IllegalStateException("Um estorno não é estornado.");
        }
        return new MovimentoEstoque(null, produtoId, remessaId, TipoMovimento.ESTORNO, -quantidade, em, usuarioSubject,
                usuarioNome, referenciaTipo, referenciaId, id);
    }
}
