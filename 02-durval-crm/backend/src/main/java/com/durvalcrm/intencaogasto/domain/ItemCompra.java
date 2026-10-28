package com.durvalcrm.intencaogasto.domain;

import java.util.Objects;

/**
 * Produto da cantina numa compra (US-EXPENSE-001). A quantidade recebida só existe depois da
 * conferência do Vendedor (US-EXPENSE-006).
 */
public record ItemCompra(long produtoId, String produtoNome, int quantidade, Integer quantidadeRecebida) {

    public ItemCompra {
        Objects.requireNonNull(produtoNome);
    }

    public static ItemCompra pedido(long produtoId, String produtoNome, int quantidade) {
        return new ItemCompra(produtoId, produtoNome, quantidade, null);
    }

    ItemCompra recebido(int quantidade) {
        return new ItemCompra(produtoId, produtoNome, this.quantidade, quantidade);
    }

    ItemCompra comQuantidade(int quantidade) {
        return new ItemCompra(produtoId, produtoNome, quantidade, null);
    }

    public boolean conferido() {
        return quantidadeRecebida != null && quantidadeRecebida == quantidade;
    }
}
