package com.durvalcrm.fechamento.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class PeriodoTest {

    private static final YearMonth SETEMBRO = YearMonth.of(2026, 9);
    private static final Autor CARLA = new Autor("sub-carla", "Carla", Instant.parse("2026-10-02T13:00:00Z"));
    private static final Autor DANIEL = new Autor("sub-daniel", "Daniel", Instant.parse("2026-10-05T13:00:00Z"));

    @Test
    void fechaComNotaOpcional() {
        Periodo p = Periodo.aberto(SETEMBRO);
        p.fechar(CARLA, "   ");
        assertThat(p.fechado()).isTrue();
        assertThat(p.getNota()).isNull();
        assertThat(p.getFechamento()).isEqualTo(CARLA);
        assertThatThrownBy(() -> p.fechar(CARLA, null)).isInstanceOf(RegraDeNegocioException.class)
                .hasMessageContaining("09/2026 já está fechado");
        assertThatThrownBy(() -> p.confirmarCartao(CARLA)).isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void reaberturaExigeJustificativaEDesfazAConfirmacaoDoCartao() {
        Periodo p = Periodo.aberto(SETEMBRO);
        assertThatThrownBy(() -> p.reabrir(DANIEL, "Erro grave na conta de luz")).isInstanceOf(RegraDeNegocioException.class);
        p.confirmarCartao(CARLA);
        p.fechar(CARLA, "Tudo conferido");
        assertThatThrownBy(() -> p.reabrir(DANIEL, "Erro de digitação")).isInstanceOf(ValidacaoException.class);
        p.reabrir(DANIEL, "  Conta de luz lançada   em dobro no dia 12  ");
        assertThat(p.getStatus()).isEqualTo(StatusPeriodo.REABERTO);
        assertThat(p.getJustificativa()).isEqualTo("Conta de luz lançada em dobro no dia 12");
        assertThat(p.getCartaoConfirmado()).isNull();
        assertThat(p.getReabertura()).isEqualTo(DANIEL);
        // Volta pelo checklist e fecha de novo.
        p.confirmarCartao(CARLA);
        p.fechar(CARLA, null);
        assertThat(p.fechado()).isTrue();
    }
}
