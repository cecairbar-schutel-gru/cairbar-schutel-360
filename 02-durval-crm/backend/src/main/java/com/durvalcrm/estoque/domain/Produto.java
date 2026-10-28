package com.durvalcrm.estoque.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Livro ou produto da cantina com o preço vigente (US-INVENTORY-001/002) e o saldo atual, que é a
 * soma dos lotes próprio e por remessa.
 */
public record Produto(long id, TipoProduto tipo, String nome, String categoria, String autor, String isbn,
        BigDecimal preco, boolean ativo, int saldo) {

    public Produto {
        Objects.requireNonNull(tipo);
        Objects.requireNonNull(nome);
        Objects.requireNonNull(preco);
    }
}
