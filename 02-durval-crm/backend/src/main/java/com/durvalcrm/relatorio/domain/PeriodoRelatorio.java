package com.durvalcrm.relatorio.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Período de um relatório (regras comuns do módulo): o mês corrente por padrão ou um intervalo de
 * datas, com as duas pontas incluídas. Limitado a cinco anos para manter as consultas rápidas.
 */
public record PeriodoRelatorio(LocalDate de, LocalDate ate) {

    static final long MAXIMO_DIAS = 5 * 366;

    public PeriodoRelatorio {
        List<ErroCampo> erros = new ArrayList<>();
        if (de == null) {
            erros.add(new ErroCampo("de", "Informe a data inicial."));
        }
        if (ate == null) {
            erros.add(new ErroCampo("ate", "Informe a data final."));
        }
        if (de != null && ate != null && de.isAfter(ate)) {
            erros.add(new ErroCampo("ate", "A data final deve ser igual ou posterior à inicial."));
        }
        if (de != null && ate != null && ChronoUnit.DAYS.between(de, ate) > MAXIMO_DIAS) {
            erros.add(new ErroCampo("ate", "Escolha um período de até cinco anos."));
        }
        ValidacaoException.lancarSeHouver(erros);
    }

    /** Sem datas: o mês de {@code hoje}; só uma das pontas é erro. */
    public static PeriodoRelatorio ouMesDe(LocalDate de, LocalDate ate, LocalDate hoje) {
        if (de == null && ate == null) {
            YearMonth mes = YearMonth.from(hoje);
            return new PeriodoRelatorio(mes.atDay(1), mes.atEndOfMonth());
        }
        return new PeriodoRelatorio(de, ate);
    }

    public boolean contem(LocalDate data) {
        return data != null && !data.isBefore(de) && !data.isAfter(ate);
    }
}
