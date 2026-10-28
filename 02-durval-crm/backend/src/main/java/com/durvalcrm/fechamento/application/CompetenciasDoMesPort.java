package com.durvalcrm.fechamento.application;

import java.math.BigDecimal;
import java.time.YearMonth;

/** Resumo das mensalidades do mês para o demonstrativo (US-CLOSING-007). Implementada pelo módulo Contribuições. */
public interface CompetenciasDoMesPort {

    ResumoCompetencias resumo(YearMonth mes);

    /** Competências do mês (canceladas não contam), com a situação atual de cada uma. */
    record ResumoCompetencias(long geradas, long pagas, long pendentes, BigDecimal valorGerado, BigDecimal valorPago,
            BigDecimal valorPendente) {
    }
}
