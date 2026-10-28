package com.durvalcrm.relatorio.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import org.junit.jupiter.api.Test;

class RegrasRelatorioTest {

    @Test
    void periodoPadraoEOMesDeHoje() {
        PeriodoRelatorio p = PeriodoRelatorio.ouMesDe(null, null, LocalDate.of(2026, 2, 10));
        assertThat(p.de()).isEqualTo(LocalDate.of(2026, 2, 1));
        assertThat(p.ate()).isEqualTo(LocalDate.of(2026, 2, 28));
    }

    @Test
    void periodoInvertidoOuIncompletoEErro() {
        assertThatThrownBy(() -> new PeriodoRelatorio(LocalDate.of(2026, 3, 2), LocalDate.of(2026, 3, 1)))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> PeriodoRelatorio.ouMesDe(LocalDate.of(2026, 3, 2), null, LocalDate.now()))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void semanasVaoDeSegundaADomingoCortadasNasPontas() {
        // 01/10/2026 é quinta-feira.
        var intervalos = Agrupamento.SEMANA.intervalos(new PeriodoRelatorio(LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 14)));
        assertThat(intervalos).extracting(i -> i.inicio().getDayOfMonth() + "-" + i.fim().getDayOfMonth())
                .containsExactly("1-4", "5-11", "12-14");
        assertThat(Agrupamento.MES.intervalos(new PeriodoRelatorio(LocalDate.of(2026, 9, 15),
                LocalDate.of(2026, 11, 2)))).hasSize(3);
        assertThat(Agrupamento.DIA.intervalos(new PeriodoRelatorio(LocalDate.of(2026, 9, 15),
                LocalDate.of(2026, 9, 17)))).hasSize(3);
    }

    @Test
    void colunasDoEstoque() {
        assertThat(ColunaEstoque.de("VENDA", null)).isEqualTo(ColunaEstoque.VENDA);
        assertThat(ColunaEstoque.VENDA.naColuna(-3)).isEqualTo(3);
        assertThat(ColunaEstoque.de("CANCELAMENTO_VENDA", null).naColuna(1)).isEqualTo(-1);
        assertThat(ColunaEstoque.de("ESTORNO", "ENTRADA_DOACAO")).isEqualTo(ColunaEstoque.DOACAO);
        assertThat(ColunaEstoque.de("BAIXA_DANO", null)).isEqualTo(ColunaEstoque.BAIXA);
        assertThat(ColunaEstoque.motivoBaixa("ESTORNO", "BAIXA_EXTRAVIO")).isEqualTo("EXTRAVIO");
        assertThat(ColunaEstoque.de("AJUSTE", null).naColuna(-2)).isEqualTo(-2);
    }

    @Test
    void classeDoRecebimentoDaMensalidade() {
        LocalDate dia = LocalDate.of(2026, 10, 5);
        assertThat(ClasseRecebimento.de(YearMonth.of(2026, 9), dia)).isEqualTo(ClasseRecebimento.ATRASADA);
        assertThat(ClasseRecebimento.de(YearMonth.of(2026, 10), dia)).isEqualTo(ClasseRecebimento.MES_CORRENTE);
        assertThat(ClasseRecebimento.de(YearMonth.of(2027, 1), dia)).isEqualTo(ClasseRecebimento.ANTECIPADA);
    }

    @Test
    void percentualComUmaCasa() {
        assertThat(Percentual.de(new BigDecimal("1"), new BigDecimal("3"))).isEqualByComparingTo("33.3");
        assertThat(Percentual.de(2, 0)).isNull();
    }
}
