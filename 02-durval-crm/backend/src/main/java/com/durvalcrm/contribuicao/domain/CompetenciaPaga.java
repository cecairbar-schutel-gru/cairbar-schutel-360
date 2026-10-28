package com.durvalcrm.contribuicao.domain;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Objects;

/** Competência quitada por uma contribuição, com o valor cobrado; preservada mesmo após o cancelamento. */
public record CompetenciaPaga(YearMonth mes, BigDecimal valor) {

    public CompetenciaPaga {
        Objects.requireNonNull(mes);
        Objects.requireNonNull(valor);
    }
}
