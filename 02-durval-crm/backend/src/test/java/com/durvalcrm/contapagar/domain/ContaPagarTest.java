package com.durvalcrm.contapagar.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ContaPagarTest {

    static final Categoria ENERGIA = new Categoria("DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "Energia elétrica",
            TipoCategoria.DESPESA, "DESPESAS_OPERACIONAIS", "Despesas operacionais", true);
    static final Categoria REPASSE = new Categoria("DESPESAS_COMERCIAIS.REPASSE_EDITORAS", "Repasse às editoras",
            TipoCategoria.DESPESA, "DESPESAS_COMERCIAIS", "Despesas comerciais", true);

    static ContaPagar.Dados dados(Recorrencia r, String primeiro, String fim) {
        return new ContaPagar.Dados("Conta de luz", "Enel", ENERGIA.codigo(), new BigDecimal("180.00"), r,
                LocalDate.parse(primeiro), fim == null ? null : LocalDate.parse(fim), null, null);
    }

    @Test
    void mensalNoDia31UsaOUltimoDiaDosMesesCurtos() {
        ContaPagar c = ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-31", null), ENERGIA);
        assertThat(c.vencimentos(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-04-30"))).containsExactly(
                LocalDate.parse("2026-01-31"), LocalDate.parse("2026-02-28"), LocalDate.parse("2026-03-31"),
                LocalDate.parse("2026-04-30"));
    }

    @Test
    void respeitaOFimDaRecorrenciaEAJanela() {
        ContaPagar c = ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", "2026-03-10"), ENERGIA);
        assertThat(c.vencimentos(LocalDate.parse("2026-02-01"), LocalDate.parse("2026-12-31")))
                .containsExactly(LocalDate.parse("2026-02-10"), LocalDate.parse("2026-03-10"));
        assertThat(c.venceEm(LocalDate.parse("2026-04-10"))).isFalse();
    }

    @Test
    void unicaEAnual() {
        ContaPagar unica = ContaPagar.nova(dados(Recorrencia.UNICA, "2026-05-05", "2027-01-01"), ENERGIA);
        assertThat(unica.fimRecorrencia()).isNull();
        assertThat(unica.vencimentos(LocalDate.parse("2026-01-01"), LocalDate.parse("2030-01-01")))
                .containsExactly(LocalDate.parse("2026-05-05"));
        ContaPagar anual = ContaPagar.nova(dados(Recorrencia.ANUAL, "2024-02-29", null), ENERGIA);
        assertThat(anual.vencimentos(LocalDate.parse("2025-01-01"), LocalDate.parse("2028-12-31"))).containsExactly(
                LocalDate.parse("2025-02-28"), LocalDate.parse("2026-02-28"), LocalDate.parse("2027-02-28"),
                LocalDate.parse("2028-02-29"));
    }

    @Test
    void unicaPagaFicaQuitadaEOEstornoAReativa() {
        ContaPagar unica = ContaPagar.nova(dados(Recorrencia.UNICA, "2026-05-05", null), ENERGIA);
        ContaPagar quitada = unica.aposPagamento();
        assertThat(quitada.ativa()).isFalse();
        assertThat(quitada.quitada(true)).isTrue();
        assertThat(quitada.quitada(false)).isFalse();
        assertThat(quitada.aposEstorno().ativa()).isTrue();
        assertThat(unica.aposEstorno()).isSameAs(unica);
    }

    @Test
    void recorrentePagaContinuaAtiva() {
        ContaPagar mensal = ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", null), ENERGIA);
        assertThat(mensal.aposPagamento()).isSameAs(mensal);
        assertThat(mensal.encerrada().aposEstorno().ativa()).isFalse();
        assertThat(mensal.encerrada().quitada(true)).isFalse();
    }

    @Test
    void encerradaNaoTemVencimentosEmAberto() {
        ContaPagar c = ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", null), ENERGIA).encerrada();
        assertThat(c.vencimentos(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-12-31"))).isEmpty();
        assertThatThrownBy(c::encerrada).isInstanceOf(RegraDeNegocioException.class);
        assertThat(c.reativada().ativa()).isTrue();
    }

    @Test
    void exigeSubcategoriaDeDespesaSemFluxoProprio() {
        assertThatThrownBy(() -> ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", null), REPASSE))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", "2025-12-01"), ENERGIA))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void recorrenciaNaoMudaDepoisDoPrimeiroPagamento() {
        ContaPagar c = ContaPagar.nova(dados(Recorrencia.MENSAL, "2026-01-10", null), ENERGIA);
        assertThatThrownBy(() -> c.alterada(dados(Recorrencia.ANUAL, "2026-01-10", null), ENERGIA,
                LocalDate.parse("2026-01-10"), true)).isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> c.alterada(dados(Recorrencia.MENSAL, "2026-01-10", "2026-01-31"), ENERGIA,
                LocalDate.parse("2026-02-10"), true)).isInstanceOf(ValidacaoException.class);
        assertThat(c.alterada(dados(Recorrencia.MENSAL, "2026-01-10", "2026-06-10"), ENERGIA,
                LocalDate.parse("2026-02-10"), true).fimRecorrencia()).isEqualTo(LocalDate.parse("2026-06-10"));
    }
}
