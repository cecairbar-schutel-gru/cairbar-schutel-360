package com.durvalcrm.contribuicao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;

class ContribuicaoTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");
    private static final LocalDate HOJE = LocalDate.of(2026, 10, 19);
    private static final List<CompetenciaPaga> SET_OUT = List.of(
            new CompetenciaPaga(YearMonth.of(2026, 9), new BigDecimal("50.00")),
            new CompetenciaPaga(YearMonth.of(2026, 10), new BigDecimal("50.00")));

    private static Pagamento pix(String valor) {
        return new Pagamento(MeioPagamento.PIX, 2, "Banco A", new BigDecimal(valor));
    }

    private static Pagamento cartao(String valor) {
        return new Pagamento(MeioPagamento.CARTAO, 3, "Cartão a receber", new BigDecimal(valor), TipoCartao.CREDITO);
    }

    private static Contribuicao registrar(List<CompetenciaPaga> comps, String doacao, List<Pagamento> pagamentos) {
        return Contribuicao.registrar(new Recebimento(7L, false, comps, new BigDecimal(doacao), pagamentos, null), "sub", "Ana", AGORA, HOJE, "chave", () -> "2026-000123");
    }

    private static String mensagem(Runnable r) {
        try {
            r.run();
        } catch (ValidacaoException e) {
            return e.getErros().getFirst().mensagem();
        }
        throw new AssertionError("Esperava ValidacaoException");
    }

    /** Exemplo da US-CONTRIB-004: R$ 100,00 devidos, R$ 120,00 recebidos, R$ 20,00 classificados como doação. */
    @Test
    void excedenteClassificadoComoDoacaoFechaASoma() {
        Contribuicao c = registrar(SET_OUT, "20.00", List.of(pix("70.00"), cartao("50.00")));

        assertThat(c.getTipo()).isEqualTo(TipoContribuicao.MENSALIDADE);
        assertThat(c.total()).isEqualByComparingTo("120.00");
        assertThat(c.totalCompetencias()).isEqualByComparingTo("100.00");
        assertThat(c.valorPorMeio(MeioPagamento.CARTAO)).isEqualByComparingTo("50.00");
        assertThat(c.getNumeroRecibo()).isEqualTo("2026-000123");
    }

    /** Simulação de 27/10/2026, P9: crédito ou débito é obrigatório no cartão. */
    @Test
    void cartaoSemTipoEhBloqueado() {
        Pagamento semTipo = new Pagamento(MeioPagamento.CARTAO, 3, "Cartão a receber", new BigDecimal("100.00"));
        assertThat(mensagem(() -> registrar(SET_OUT, "0", List.of(semTipo))))
                .isEqualTo("Informe se o cartão é de crédito ou de débito.");
    }

    @Test
    void valorRecebidoMenorQueAsCompetenciasEhBloqueado() {
        assertThat(mensagem(() -> registrar(SET_OUT, "0", List.of(pix("70.00")))))
                .isEqualTo("Faltam R$ 30,00 no valor recebido. Remova uma competência ou ajuste os valores.");
    }

    @Test
    void excedenteNuncaFicaSemClassificacao() {
        assertThat(mensagem(() -> registrar(SET_OUT, "0", List.of(pix("70.00"), cartao("50.00")))))
                .startsWith("Há R$ 20,00 de excedente sem classificação.");
        assertThat(mensagem(() -> registrar(SET_OUT, "30.00", List.of(pix("70.00"), cartao("50.00")))))
                .isEqualTo("A doação informada é maior que o excedente de R$ 20,00.");
    }

    @Test
    void valoresPrecisamSerPositivosComDuasCasas() {
        assertThat(mensagem(() -> registrar(List.of(), "10.005", List.of(pix("10.005")))))
                .isEqualTo("Os valores devem ser positivos, com até duas casas decimais.");
        assertThat(mensagem(() -> registrar(List.of(), "0", List.of(pix("0")))))
                .isEqualTo("Os valores devem ser positivos, com até duas casas decimais.");
        assertThat(mensagem(() -> registrar(List.of(), "0", List.of())))
                .isEqualTo("Informe o valor recebido em ao menos um meio de pagamento.");
    }

    @Test
    void numeroDoReciboSoEhConsumidoDepoisDaValidacao() {
        int[] chamadas = {0};
        assertThatThrownBy(() -> Contribuicao.registrar(new Recebimento(7L, false, SET_OUT, BigDecimal.ZERO,
                List.of(pix("10.00")), null), "sub", "Ana", AGORA, HOJE, "k", () -> {
                    chamadas[0]++;
                    return "x";
                })).isInstanceOf(ValidacaoException.class);
        assertThat(chamadas[0]).isZero();
    }

    @Test
    void doacaoAnonimaNaoSeVinculaADoador() {
        Contribuicao c = Contribuicao.registrar(new Recebimento(null, true, List.of(), new BigDecimal("15.00"),
                List.of(new Pagamento(MeioPagamento.DINHEIRO, 1, "Caixa", new BigDecimal("15.00"))),
                "Caixa de ofertas"), "sub", "Ana", AGORA, HOJE, "k", () -> "2026-000001");
        assertThat(c.getTipo()).isEqualTo(TipoContribuicao.DOACAO_ANONIMA);
        assertThat(c.getDoadorId()).isNull();

        assertThatThrownBy(() -> Contribuicao.registrar(new Recebimento(7L, true, List.of(), BigDecimal.ONE,
                List.of(pix("1.00")), null), "sub", "Ana", AGORA, HOJE, "k", () -> "x"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void observacaoTemAte200Caracteres() {
        assertThat(mensagem(() -> Contribuicao.registrar(new Recebimento(7L, false, List.of(), new BigDecimal("5.00"),
                List.of(pix("5.00")), "x".repeat(201)), "sub", "Ana", AGORA, HOJE, "k", () -> "x")))
                .isEqualTo("A observação deve ter até 200 caracteres.");
    }

    @Test
    void cancelarPreservaOOriginalEExigeMotivo() {
        Contribuicao c = registrar(SET_OUT, "0", List.of(pix("100.00")));
        assertThat(mensagem(() -> c.cancelar("curto", "Carla", AGORA)))
                .isEqualTo("Informe o motivo com pelo menos 10 caracteres.");

        c.cancelar("  Lançada no doador errado  ", "Carla", AGORA);
        assertThat(c.getStatus()).isEqualTo(StatusContribuicao.CANCELADA);
        assertThat(c.getMotivoCancelamento()).isEqualTo("Lançada no doador errado");
        assertThat(c.getCanceladaPor()).isEqualTo("Carla");
        assertThat(c.total()).isEqualByComparingTo("100.00");
        assertThatThrownBy(() -> c.cancelar("de novo, outra vez", "Carla", AGORA))
                .isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void antecipadaDeMesFuturoEhRemovidaAoEstornarAsDemaisReabrem() {
        Competencia antecipada = Competencia.gerarPaga(7, YearMonth.of(2026, 12), new BigDecimal("50.00"), 1, HOJE, "r");
        Competencia jaChegou = Competencia.gerarPaga(7, YearMonth.of(2026, 10), new BigDecimal("50.00"), 1, HOJE, "r");
        Competencia gerada = Competencia.gerar(7, YearMonth.of(2026, 12), new BigDecimal("50.00"));

        assertThat(antecipada.deveSerRemovidaAoEstornar(YearMonth.of(2026, 10))).isTrue();
        assertThat(jaChegou.deveSerRemovidaAoEstornar(YearMonth.of(2026, 10))).isFalse();
        assertThat(gerada.deveSerRemovidaAoEstornar(YearMonth.of(2026, 10))).isFalse();
    }
}
