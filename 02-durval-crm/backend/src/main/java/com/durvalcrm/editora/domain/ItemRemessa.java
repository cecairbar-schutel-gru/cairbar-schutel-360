package com.durvalcrm.editora.domain;

import java.math.BigDecimal;
import java.util.Objects;

/** Título recebido numa remessa, com o percentual de repasse fixado no recebimento (US-PUBLISHER-003). */
public record ItemRemessa(long remessaId, String remessaCodigo, long editoraId, long produtoId,
        BigDecimal repassePercentual) {

    public ItemRemessa {
        Objects.requireNonNull(remessaCodigo);
        Objects.requireNonNull(repassePercentual);
    }
}
