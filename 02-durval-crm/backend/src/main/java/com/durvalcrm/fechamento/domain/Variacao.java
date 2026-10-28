package com.durvalcrm.fechamento.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Comparação de uma linha do demonstrativo com o mês anterior (US-CLOSING-013). Destaque quando a
 * variação passa de 20% e de R$ 100,00 (sem valor no mês anterior, conta só a diferença).
 *
 * @param percentual diferença sobre o mês anterior, com uma casa; nulo quando o anterior é zero
 */
public record Variacao(BigDecimal atual, BigDecimal anterior, BigDecimal diferenca, BigDecimal percentual,
        boolean destaque) {

    static final BigDecimal LIMITE_VALOR = new BigDecimal("100.00");
    static final BigDecimal LIMITE_PERCENTUAL = new BigDecimal("20");

    public static Variacao de(BigDecimal atual, BigDecimal anterior) {
        BigDecimal a = atual == null ? BigDecimal.ZERO : atual;
        BigDecimal b = anterior == null ? BigDecimal.ZERO : anterior;
        BigDecimal diferenca = a.subtract(b);
        BigDecimal percentual = b.signum() == 0 ? null
                : diferenca.multiply(BigDecimal.valueOf(100)).divide(b.abs(), 1, RoundingMode.HALF_UP);
        boolean destaque = diferenca.abs().compareTo(LIMITE_VALOR) > 0
                && (percentual == null || percentual.abs().compareTo(LIMITE_PERCENTUAL) > 0);
        return new Variacao(a, b, diferenca, percentual, destaque);
    }
}
