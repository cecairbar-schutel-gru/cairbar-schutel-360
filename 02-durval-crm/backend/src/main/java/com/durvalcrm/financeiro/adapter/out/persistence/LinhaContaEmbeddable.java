package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.shared.domain.TipoCartao;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.math.BigDecimal;

@Embeddable
public class LinhaContaEmbeddable {

    @Column(name = "conta_id", nullable = false)
    private long contaId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_cartao")
    private TipoCartao tipoCartao;

    protected LinhaContaEmbeddable() {
    }

    LinhaContaEmbeddable(long contaId, BigDecimal valor, TipoCartao tipoCartao) {
        this.contaId = contaId;
        this.valor = valor;
        this.tipoCartao = tipoCartao;
    }

    long getContaId() { return contaId; }
    BigDecimal getValor() { return valor; }
    TipoCartao getTipoCartao() { return tipoCartao; }
}
