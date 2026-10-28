package com.durvalcrm.relatorio.adapter.out.exportacao;

import com.durvalcrm.relatorio.application.DocumentoExportacao.Formato;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Formatação pt-BR das células no PDF: R$ 1.234,56, 1.234, 45,3% e dd/mm/aaaa. */
final class Formatos {

    private static final Locale PT_BR = Locale.of("pt", "BR");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private Formatos() {
    }

    static String texto(Object valor, Formato formato) {
        if (valor == null) {
            return "";
        }
        if (valor instanceof LocalDate d) {
            return DATA.format(d);
        }
        if (valor instanceof String s) {
            return s;
        }
        BigDecimal numero = numero(valor);
        if (numero == null) {
            return String.valueOf(valor);
        }
        return switch (formato) {
            case MOEDA -> (numero.signum() < 0 ? "-R$ " : "R$ ") + decimal("#,##0.00").format(numero.abs());
            case PERCENTUAL -> decimal("#,##0.0").format(numero.setScale(1, RoundingMode.HALF_UP)) + "%";
            case INTEIRO -> decimal("#,##0").format(numero);
            default -> numero.toPlainString();
        };
    }

    static BigDecimal numero(Object valor) {
        if (valor instanceof BigDecimal b) {
            return b;
        }
        if (valor instanceof Integer || valor instanceof Long) {
            return BigDecimal.valueOf(((Number) valor).longValue());
        }
        if (valor instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        return null;
    }

    private static DecimalFormat decimal(String padrao) {
        return new DecimalFormat(padrao, DecimalFormatSymbols.getInstance(PT_BR));
    }
}
