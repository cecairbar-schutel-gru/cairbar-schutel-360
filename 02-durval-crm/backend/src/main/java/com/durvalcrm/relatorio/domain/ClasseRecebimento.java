package com.durvalcrm.relatorio.domain;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * Mensalidade recebida (US-REPORT-004) conforme a competência e o mês do recebimento: de mês
 * anterior (atrasada), do próprio mês ou antecipada.
 */
public enum ClasseRecebimento {
    ATRASADA,
    MES_CORRENTE,
    ANTECIPADA;

    public static ClasseRecebimento de(YearMonth competencia, LocalDate recebimento) {
        int comparacao = competencia.compareTo(YearMonth.from(recebimento));
        return comparacao < 0 ? ATRASADA : comparacao == 0 ? MES_CORRENTE : ANTECIPADA;
    }
}
