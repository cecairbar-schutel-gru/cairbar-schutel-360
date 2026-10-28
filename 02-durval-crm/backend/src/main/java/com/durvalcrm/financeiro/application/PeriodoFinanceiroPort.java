package com.durvalcrm.financeiro.application;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

/**
 * Situação do fechamento mensal (US-CLOSING-008): a trava única do servidor. Nenhum lançamento,
 * movimento de estoque datado, conciliação ou reclassificação pode cair num mês fechado. Implementada
 * pelo módulo Fechamento, para que o Financeiro não dependa dele.
 */
public interface PeriodoFinanceiroPort {

    DateTimeFormatter MES = DateTimeFormatter.ofPattern("MM/yyyy");

    boolean estaFechado(YearMonth mes);

    /** Código PERIODO_FECHADO (409) se a data cai num mês fechado. */
    default void exigirAberto(LocalDate data) {
        if (data != null && estaFechado(YearMonth.from(data))) {
            throw new RegraDeNegocioException("PERIODO_FECHADO", "O mês de " + MES.format(data)
                    + " está fechado. Use uma data do período aberto ou peça ao Administrador a reabertura.");
        }
    }
}
