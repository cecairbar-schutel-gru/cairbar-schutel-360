package com.durvalcrm.estoque.domain;

/** Unidades de um produto por origem: próprio ({@code remessaId} nulo) ou de uma remessa consignada. */
public record Lote(long produtoId, Long remessaId, String remessaCodigo, int quantidade) {

    public boolean consignado() {
        return remessaId != null;
    }
}
