package com.durvalcrm.editora.application;

import java.math.BigDecimal;

/** Obrigação criada por uma venda, com o que a venda guarda para o detalhe (US-SALES-011). */
public record ObrigacaoGerada(long id, long editoraId, String remessaCodigo, BigDecimal repassePercentual,
        BigDecimal valor) {
}
