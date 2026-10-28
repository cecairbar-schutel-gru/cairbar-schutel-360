package com.durvalcrm.financeiro.domain;

import java.math.BigDecimal;
import java.util.Objects;

/** Classificação de receita ou despesa de um lançamento, pelo código da subcategoria. */
public record LinhaCategoria(String categoria, BigDecimal valor) {

    public LinhaCategoria {
        Objects.requireNonNull(categoria);
        Objects.requireNonNull(valor);
    }
}
