package com.durvalcrm.administracao.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Conversão dos valores das planilhas: datas dd/mm/aaaa, meses mm/aaaa e valores 1.234,56 (ou ISO). */
public final class ValoresPlanilha {

    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/uuuu")
            .withResolverStyle(ResolverStyle.STRICT);
    private static final DateTimeFormatter MES_BR = DateTimeFormatter.ofPattern("MM/uuuu")
            .withResolverStyle(ResolverStyle.STRICT);

    private ValoresPlanilha() {
    }

    public static Optional<LocalDate> data(String valor) {
        String v = valor.trim();
        try {
            return Optional.of(v.contains("/") ? LocalDate.parse(zeros(v, 3), DATA_BR) : LocalDate.parse(v));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    public static Optional<YearMonth> mes(String valor) {
        String v = valor.trim();
        try {
            return Optional.of(v.contains("/") ? YearMonth.parse(zeros(v, 2), MES_BR) : YearMonth.parse(v));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    /** Lista de meses separados por vírgula, ponto e vírgula ou espaço ("09/2026, 10/2026"). */
    public static Optional<List<YearMonth>> meses(String valor) {
        List<YearMonth> meses = new ArrayList<>();
        for (String parte : valor.split("[,;\\s]+")) {
            if (parte.isBlank()) {
                continue;
            }
            Optional<YearMonth> m = mes(parte);
            if (m.isEmpty()) {
                return Optional.empty();
            }
            if (!meses.contains(m.get())) {
                meses.add(m.get());
            }
        }
        return Optional.of(meses);
    }

    /** "R$ 1.234,56", "1234,56" ou "1234.56"; nunca mais de 2 casas. */
    public static Optional<BigDecimal> valor(String valor) {
        String v = valor.replace("R$", "").replace(" ", "").replace(" ", "").trim();
        if (v.contains(",")) {
            v = v.replace(".", "").replace(",", ".");
        }
        try {
            BigDecimal b = new BigDecimal(v);
            return b.stripTrailingZeros().scale() > 2 ? Optional.empty() : Optional.of(b.setScale(2));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** "1/9/2026" → "01/09/2026". */
    private static String zeros(String v, int partes) {
        String[] p = v.split("/");
        if (p.length != partes) {
            return v;
        }
        StringBuilder r = new StringBuilder();
        for (int i = 0; i < p.length; i++) {
            r.append(i > 0 ? "/" : "").append(i < p.length - 1 && p[i].length() == 1 ? "0" + p[i] : p[i]);
        }
        return r.toString();
    }
}
