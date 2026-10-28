package com.durvalcrm.financeiro.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

@Embeddable
public class LinhaCategoriaEmbeddable {

    @Column(name = "categoria_codigo", nullable = false)
    private String categoria;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    protected LinhaCategoriaEmbeddable() {
    }

    LinhaCategoriaEmbeddable(String categoria, BigDecimal valor) {
        this.categoria = categoria;
        this.valor = valor;
    }

    String getCategoria() { return categoria; }
    BigDecimal getValor() { return valor; }
}
