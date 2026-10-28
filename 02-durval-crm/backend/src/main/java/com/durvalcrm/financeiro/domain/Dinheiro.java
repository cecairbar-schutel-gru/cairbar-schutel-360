package com.durvalcrm.financeiro.domain;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Formatação usada nas mensagens de regra (R$ 1.234,56 e dd/mm/aaaa). */
public final class Dinheiro {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private Dinheiro() {
    }

    public static String brl(BigDecimal valor) {
        return NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(valor).replace(' ', ' ');
    }

    public static String data(LocalDate data) {
        return DATA.format(data);
    }
}
