package com.durvalcrm.relatorio.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Dados das mensalidades para o relatório (US-REPORT-004). Implementada pelo módulo Contribuições. */
public interface MensalidadesParaRelatorioPort {

    /** Competências por mês, com a situação atual; meses sem competência não vêm. */
    List<CompetenciasDoMes> competencias(YearMonth de, YearMonth ate);

    /**
     * Competências pagas por contribuições recebidas no período (data financeira) e as de contribuições
     * canceladas no período (data do estorno), estas com {@code estorno} verdadeiro.
     */
    List<MensalidadeRecebida> recebidas(LocalDate de, LocalDate ate);

    /** Doadores ativos com pelo menos {@code minimo} competências pendentes até o mês, das que mais devem. */
    List<DoadorComPendencias> doadoresComPendencias(int minimo, YearMonth ate);

    record CompetenciasDoMes(YearMonth mes, long geradas, long pagas, long pendentes, long canceladas,
            BigDecimal valorGerado, BigDecimal valorPago, BigDecimal valorPendente) {
    }

    record MensalidadeRecebida(LocalDate data, YearMonth competencia, BigDecimal valor, boolean estorno) {
    }

    /** @param ultimoPagamento data da última competência paga (nula se nunca pagou) */
    record DoadorComPendencias(long doadorId, String nome, long pendentes, BigDecimal valorPendente,
            LocalDate ultimoPagamento) {
    }
}
