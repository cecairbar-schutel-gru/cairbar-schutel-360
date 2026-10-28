package com.durvalcrm.contribuicao.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Embeddable
public class CompetenciaPagaEmbeddable {

    @Column(nullable = false)
    private LocalDate mes;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    protected CompetenciaPagaEmbeddable() {
    }

    CompetenciaPagaEmbeddable(LocalDate mes, BigDecimal valor) {
        this.mes = mes;
        this.valor = valor;
    }

    LocalDate getMes() { return mes; }
    BigDecimal getValor() { return valor; }
}
