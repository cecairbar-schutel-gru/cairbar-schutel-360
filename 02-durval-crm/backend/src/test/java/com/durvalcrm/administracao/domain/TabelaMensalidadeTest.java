package com.durvalcrm.administracao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;

class TabelaMensalidadeTest {

    static final Autor AUTOR = new Autor("sub", "Daniel", Instant.parse("2026-10-19T12:00:00Z"));
    static final YearMonth OUTUBRO = YearMonth.of(2026, 10);

    static ValorMensalidade valor(String v, YearMonth desde) {
        return new ValorMensalidade(null, new BigDecimal(v), desde, "motivo", AUTOR);
    }

    @Test
    void cadaMesUsaOValorVigenteNele() {
        // Exemplo da US-ADMIN-002: R$ 50,00 e, a partir de 01/2027, R$ 60,00.
        TabelaMensalidade t = new TabelaMensalidade(List.of(valor("60.00", YearMonth.of(2027, 1)),
                valor("50.00", YearMonth.of(2025, 1))));
        assertThat(t.valorPara(YearMonth.of(2026, 9))).isEqualByComparingTo("50.00");
        assertThat(t.valorPara(YearMonth.of(2026, 12))).isEqualByComparingTo("50.00");
        assertThat(t.valorPara(YearMonth.of(2027, 1))).isEqualByComparingTo("60.00");
        assertThat(t.valorPara(YearMonth.of(2024, 5))).isEqualByComparingTo("50.00");
        assertThat(t.vigente(OUTUBRO).valor()).isEqualByComparingTo("50.00");
        assertThat(t.agendada(OUTUBRO)).get().extracting(ValorMensalidade::vigenteDe).isEqualTo(YearMonth.of(2027, 1));
        assertThat(t.historico()).extracting(ValorMensalidade::vigenteDe)
                .containsExactly(YearMonth.of(2027, 1), YearMonth.of(2025, 1));
    }

    @Test
    void novoValorValeDoMesSeguinteEmDianteComMotivo() {
        TabelaMensalidade t = new TabelaMensalidade(List.of(valor("50.00", YearMonth.of(2025, 1))));
        t.validar(new BigDecimal("60.00"), YearMonth.of(2026, 11), "Reajuste anual", OUTUBRO);
        assertThatThrownBy(() -> t.validar(new BigDecimal("60.00"), OUTUBRO, "Reajuste", OUTUBRO))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> t.validar(new BigDecimal("50.00"), YearMonth.of(2027, 1), "Reajuste", OUTUBRO))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> t.validar(new BigDecimal("60.001"), YearMonth.of(2027, 1), "Reajuste", OUTUBRO))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> t.validar(new BigDecimal("60.00"), YearMonth.of(2027, 1), " ", OUTUBRO))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void soUmAgendamentoPorVez() {
        TabelaMensalidade t = new TabelaMensalidade(List.of(valor("50.00", YearMonth.of(2025, 1)),
                valor("60.00", YearMonth.of(2027, 1))));
        assertThatThrownBy(() -> t.exigirSemAgendamento(OUTUBRO)).isInstanceOf(RegraDeNegocioException.class)
                .hasMessageContaining("agendada");
        // Quando o mês do agendamento começa, ele vira o vigente e não pode mais ser alterado.
        assertThatThrownBy(() -> t.exigirAgendada(YearMonth.of(2027, 1))).isInstanceOf(RegraDeNegocioException.class);
    }
}
