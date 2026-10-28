package com.durvalcrm.venda.adapter.out.persistence;

import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.shared.domain.TipoCartao;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;

@Embeddable
public class PagamentoVendaEmbeddable {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeioPagamento meio;

    @Column(name = "conta_id", nullable = false)
    private long contaId;

    @Column(name = "conta_nome", nullable = false)
    private String contaNome;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_cartao")
    private TipoCartao tipoCartao;

    protected PagamentoVendaEmbeddable() {
    }

    PagamentoVendaEmbeddable(MeioPagamento meio, long contaId, String contaNome, BigDecimal valor, TipoCartao tipoCartao) {
        this.meio = meio;
        this.contaId = contaId;
        this.contaNome = contaNome;
        this.valor = valor;
        this.tipoCartao = tipoCartao;
    }

    MeioPagamento getMeio() { return meio; }
    long getContaId() { return contaId; }
    String getContaNome() { return contaNome; }
    BigDecimal getValor() { return valor; }
    TipoCartao getTipoCartao() { return tipoCartao; }
}
