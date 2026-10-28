package com.durvalcrm.venda.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;

@Embeddable
public class LoteVendidoEmbeddable {

    @Column(name = "produto_id", nullable = false)
    private long produtoId;

    @Column(name = "remessa_id")
    private Long remessaId;

    @Column(name = "remessa_codigo")
    private String remessaCodigo;

    @Column(nullable = false)
    private int quantidade;

    @Column(name = "repasse_percentual", precision = 5, scale = 2)
    private BigDecimal repassePercentual;

    @Column(name = "obrigacao_id")
    private Long obrigacaoId;

    @Column(name = "valor_obrigacao", precision = 12, scale = 2)
    private BigDecimal valorObrigacao;

    protected LoteVendidoEmbeddable() {
    }

    LoteVendidoEmbeddable(long produtoId, Long remessaId, String remessaCodigo, int quantidade,
            BigDecimal repassePercentual, Long obrigacaoId, BigDecimal valorObrigacao) {
        this.produtoId = produtoId;
        this.remessaId = remessaId;
        this.remessaCodigo = remessaCodigo;
        this.quantidade = quantidade;
        this.repassePercentual = repassePercentual;
        this.obrigacaoId = obrigacaoId;
        this.valorObrigacao = valorObrigacao;
    }

    long getProdutoId() { return produtoId; }
    Long getRemessaId() { return remessaId; }
    String getRemessaCodigo() { return remessaCodigo; }
    int getQuantidade() { return quantidade; }
    BigDecimal getRepassePercentual() { return repassePercentual; }
    Long getObrigacaoId() { return obrigacaoId; }
    BigDecimal getValorObrigacao() { return valorObrigacao; }
}
