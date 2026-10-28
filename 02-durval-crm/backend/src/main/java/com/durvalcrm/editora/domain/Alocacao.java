package com.durvalcrm.editora.domain;

import java.math.BigDecimal;
import java.util.Objects;

/** Quanto de um pagamento cobriu uma obrigação. */
public record Alocacao(long obrigacaoId, BigDecimal valor) {

    public Alocacao {
        Objects.requireNonNull(valor);
    }
}
