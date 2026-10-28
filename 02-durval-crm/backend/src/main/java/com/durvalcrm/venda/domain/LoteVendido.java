package com.durvalcrm.venda.domain;

import java.math.BigDecimal;

/**
 * Unidades de um item tiradas de um lote: próprio (sem remessa nem obrigação) ou consignado, com a
 * remessa, o percentual de repasse congelado e a obrigação criada com a editora (US-SALES-006).
 */
public record LoteVendido(long produtoId, Long remessaId, String remessaCodigo, int quantidade,
        BigDecimal repassePercentual, Long obrigacaoId, BigDecimal valorObrigacao) {

    public static LoteVendido proprio(long produtoId, int quantidade) {
        return new LoteVendido(produtoId, null, null, quantidade, null, null, null);
    }

    public boolean consignado() {
        return remessaId != null;
    }
}
