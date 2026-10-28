package com.durvalcrm.contribuicao.domain;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.util.Collection;
import java.util.Locale;

/** Regras e formatação de valores monetários (BigDecimal, nunca ponto flutuante). */
public final class Valores {

    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");

    private Valores() {
    }

    /** Positivo e com no máximo duas casas decimais. */
    public static boolean valido(BigDecimal valor) {
        return valor != null && valor.signum() > 0 && valor.stripTrailingZeros().scale() <= 2;
    }

    public static BigDecimal soma(Collection<BigDecimal> valores) {
        return valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** "R$ 1.234,56", com espaço comum (o formato do JDK usa espaço não separável). */
    public static String brl(BigDecimal valor) {
        return NumberFormat.getCurrencyInstance(PT_BR).format(valor).replace(' ', ' ');
    }
}
