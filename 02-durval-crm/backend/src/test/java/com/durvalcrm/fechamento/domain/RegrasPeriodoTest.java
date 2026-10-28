package com.durvalcrm.fechamento.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.time.YearMonth;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class RegrasPeriodoTest {

    private static final YearMonth AGOSTO = YearMonth.of(2026, 8);
    private static final YearMonth SETEMBRO = YearMonth.of(2026, 9);
    private static final YearMonth OUTUBRO = YearMonth.of(2026, 10);

    @Test
    void fechaEmOrdemSoMesesQueJaTerminaram() {
        assertThat(RegrasPeriodo.mesAFechar(AGOSTO, Map.of(), OUTUBRO)).contains(AGOSTO);
        assertThat(RegrasPeriodo.mesAFechar(AGOSTO, Map.of(AGOSTO, StatusPeriodo.FECHADO), OUTUBRO)).contains(SETEMBRO);
        assertThat(RegrasPeriodo.mesAFechar(AGOSTO, Map.of(AGOSTO, StatusPeriodo.FECHADO,
                SETEMBRO, StatusPeriodo.FECHADO), OUTUBRO)).isEmpty();
        assertThat(RegrasPeriodo.mesAFechar(OUTUBRO, Map.of(), OUTUBRO)).isEmpty();
        assertThat(RegrasPeriodo.mesAFechar(null, Map.of(), OUTUBRO)).isEmpty();
        // Reaberto volta a ser o mês da vez.
        assertThat(RegrasPeriodo.mesAFechar(AGOSTO, Map.of(AGOSTO, StatusPeriodo.FECHADO,
                SETEMBRO, StatusPeriodo.REABERTO), OUTUBRO)).contains(SETEMBRO);

        assertThatThrownBy(() -> RegrasPeriodo.exigirVezDeFechar(OUTUBRO, Optional.empty(), OUTUBRO))
                .isInstanceOf(RegraDeNegocioException.class).hasMessageContaining("ainda não terminou");
        assertThatThrownBy(() -> RegrasPeriodo.exigirVezDeFechar(SETEMBRO, Optional.of(AGOSTO), OUTUBRO))
                .isInstanceOf(RegraDeNegocioException.class).hasMessageContaining("feche antes 08/2026");
        RegrasPeriodo.exigirVezDeFechar(AGOSTO, Optional.of(AGOSTO), OUTUBRO);
    }

    @Test
    void soOMesFechadoMaisRecentePodeSerReaberto() {
        Map<YearMonth, StatusPeriodo> situacoes = Map.of(AGOSTO, StatusPeriodo.FECHADO, SETEMBRO, StatusPeriodo.FECHADO);
        assertThat(RegrasPeriodo.ultimoFechado(situacoes)).contains(SETEMBRO);
        assertThatThrownBy(() -> RegrasPeriodo.exigirUltimoFechado(AGOSTO, RegrasPeriodo.ultimoFechado(situacoes)))
                .isInstanceOf(RegraDeNegocioException.class).hasMessageContaining("(09/2026)");
        RegrasPeriodo.exigirUltimoFechado(SETEMBRO, RegrasPeriodo.ultimoFechado(situacoes));
    }
}
