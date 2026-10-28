package com.durvalcrm.conciliacao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.conciliacao.domain.ExtratoBancario.Formato;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.LinhaNova;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.Movimento;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ExtratoBancarioTest {

    private static final LocalDate DEPOIS_DE = LocalDate.of(2026, 9, 30);
    private static final LocalDate ATE = LocalDate.of(2026, 10, 15);

    private static LocalDate d(int dia) {
        return LocalDate.of(2026, 10, dia);
    }

    private static Movimento m(long id, int dia, String valor) {
        return new Movimento(id, d(dia), new BigDecimal(valor));
    }

    private static LinhaNova linha(LocalDate data, String descricao, String valor) {
        return new LinhaNova(data, descricao, valor == null ? null : new BigDecimal(valor), null);
    }

    @Test
    void ficaSoComAsLinhasDoPeriodoDaSessao() {
        var selecao = ExtratoBancario.selecionar("extrato.ofx", Formato.OFX, List.of(
                linha(DEPOIS_DE, "Saldo anterior conciliado", "10"),
                linha(d(1), "  Tarifa   pacote  ", "-12.50"),
                linha(d(15), "", "30"),
                linha(d(16), "Depois do extrato", "5")), DEPOIS_DE, ATE);
        assertThat(selecao.ignoradas()).isEqualTo(2);
        assertThat(selecao.noPeriodo()).extracting(LinhaNova::descricao)
                .containsExactly("Tarifa pacote", "(sem descrição)");
    }

    @Test
    void recusaArquivoInvalidoOuForaDoPeriodo() {
        assertThatThrownBy(() -> ExtratoBancario.selecionar("x.csv", Formato.CSV, List.of(), DEPOIS_DE, ATE))
                .isInstanceOf(ValidacaoException.class);
        ValidacaoException e = (ValidacaoException) org.assertj.core.api.Assertions.catchThrowable(() ->
                ExtratoBancario.selecionar("x.csv", Formato.CSV, List.of(linha(d(2), "a", "0"),
                        linha(null, "b", "1"), linha(d(3), "c", "1.234")), DEPOIS_DE, ATE));
        assertThat(e.getErros()).extracting(ErroCampo::campo)
                .containsExactly("linhas[0].valor", "linhas[1].data", "linhas[2].valor");
        e = (ValidacaoException) org.assertj.core.api.Assertions.catchThrowable(() ->
                ExtratoBancario.selecionar("x.csv", Formato.CSV, List.of(linha(d(20), "a", "1")), DEPOIS_DE, ATE));
        assertThat(e.getErros().get(0).mensagem())
                .isEqualTo("Nenhuma linha do arquivo está no período desta conciliação (01/10/2026 a 15/10/2026).");
    }

    @Test
    void sugereMesmoValorComADataMaisProximaPrimeiro() {
        Map<Long, Long> pares = ExtratoBancario.sugerir(
                List.of(m(1, 5, "-100"), m(2, 10, "50"), m(3, 10, "50"), m(4, 12, "-7.90"), m(5, 14, "30")),
                List.of(m(11, 3, "-100"), m(12, 6, "-100"), m(13, 9, "50.00"), m(14, 10, "50"), m(15, 2, "-7.90"),
                        m(16, 13, "-30")));
        // Linha 1 fica com o de 06/10 (1 dia) e não o de 03/10; as duas de 50 dividem os lançamentos;
        // a de -7,90 está a 10 dias; a de 30 não casa com -30.
        assertThat(pares).containsExactlyInAnyOrderEntriesOf(Map.of(1L, 12L, 2L, 14L, 3L, 13L));
    }
}
