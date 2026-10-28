package com.durvalcrm.administracao.domain;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Objects;

/** Valor único da mensalidade a partir de um mês (US-ADMIN-002). */
public record ValorMensalidade(Long id, BigDecimal valor, YearMonth vigenteDe, String motivo, Autor autor) {

    public ValorMensalidade {
        Objects.requireNonNull(valor);
        Objects.requireNonNull(vigenteDe);
    }
}
