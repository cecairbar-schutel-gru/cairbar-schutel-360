package com.durvalcrm.estoque.domain;

/** Unidades tiradas de um lote; guardadas pela venda para devolver ao mesmo lote no cancelamento. */
public record Retirada(Long remessaId, String remessaCodigo, int quantidade) {

    public boolean consignada() {
        return remessaId != null;
    }
}
