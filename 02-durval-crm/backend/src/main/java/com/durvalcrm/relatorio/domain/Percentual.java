package com.durvalcrm.relatorio.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Participação de uma parte no total, em %, com uma casa; nula quando o total é zero. */
public final class Percentual {

    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    private Percentual() {
    }

    public static BigDecimal de(BigDecimal parte, BigDecimal total) {
        if (parte == null || total == null || total.signum() == 0) {
            return null;
        }
        return parte.multiply(CEM).divide(total, 1, RoundingMode.HALF_UP);
    }

    public static BigDecimal de(long parte, long total) {
        return de(BigDecimal.valueOf(parte), BigDecimal.valueOf(total));
    }
}
