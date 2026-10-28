package com.durvalcrm.relatorio.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Conversão entre reais (como gravados) e centavos inteiros, usados nos rateios. */
public final class Centavos {

    private Centavos() {
    }

    public static long de(BigDecimal reais) {
        return reais == null ? 0 : reais.setScale(2, RoundingMode.HALF_UP).movePointRight(2).longValueExact();
    }

    public static BigDecimal reais(long centavos) {
        return BigDecimal.valueOf(centavos, 2);
    }
}
