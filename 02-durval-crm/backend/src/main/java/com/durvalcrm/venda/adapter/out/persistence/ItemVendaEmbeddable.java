package com.durvalcrm.venda.adapter.out.persistence;

import com.durvalcrm.estoque.domain.TipoProduto;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;

@Embeddable
public class ItemVendaEmbeddable {

    @Column(name = "produto_id", nullable = false)
    private long produtoId;

    @Column(name = "produto_nome", nullable = false)
    private String produtoNome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoProduto tipo;

    @Column(nullable = false)
    private int quantidade;

    @Column(name = "preco_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal precoUnitario;

    protected ItemVendaEmbeddable() {
    }

    ItemVendaEmbeddable(long produtoId, String produtoNome, TipoProduto tipo, int quantidade, BigDecimal precoUnitario) {
        this.produtoId = produtoId;
        this.produtoNome = produtoNome;
        this.tipo = tipo;
        this.quantidade = quantidade;
        this.precoUnitario = precoUnitario;
    }

    long getProdutoId() { return produtoId; }
    String getProdutoNome() { return produtoNome; }
    TipoProduto getTipo() { return tipo; }
    int getQuantidade() { return quantidade; }
    BigDecimal getPrecoUnitario() { return precoUnitario; }
}
