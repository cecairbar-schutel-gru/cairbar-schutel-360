package com.durvalcrm.fechamento.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class JanelaFechamentoTest {

    @Test
    void temDeUmASeteDiasSeguidosAteODia28() {
        assertThat(new JanelaFechamento(3, 3, null).diaFim()).isEqualTo(3);
        assertThat(new JanelaFechamento(22, 28, null).diaInicio()).isEqualTo(22);
        assertThat(erro(() -> new JanelaFechamento(1, 8, null))).isEqualTo("diaFim: A janela tem no máximo 7 dias.");
        assertThat(erro(() -> new JanelaFechamento(5, 4, null)))
                .isEqualTo("diaFim: O último dia não pode ser antes do primeiro.");
        assertThat(erro(() -> new JanelaFechamento(0, 3, null))).startsWith("diaInicio:");
        assertThatThrownBy(() -> new JanelaFechamento(25, 29, null)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> JanelaFechamento.validar(null, 3, null)).isInstanceOf(ValidacaoException.class);
        assertThat(JanelaFechamento.PADRAO).isEqualTo(new JanelaFechamento(1, 7, null));
    }

    private static String erro(Runnable acao) {
        try {
            acao.run();
        } catch (ValidacaoException e) {
            ErroCampo erro = e.getErros().get(0);
            return erro.campo() + ": " + erro.mensagem();
        }
        throw new AssertionError("Era esperada uma ValidacaoException.");
    }

    @Test
    void soFechaDentroDaJanelaEApontaAProxima() {
        JanelaFechamento janela = new JanelaFechamento(5, 10, null);
        LocalDate dentro = LocalDate.of(2026, 10, 5);
        LocalDate antes = LocalDate.of(2026, 10, 4);
        LocalDate depois = LocalDate.of(2026, 10, 11);

        assertThat(janela.contem(dentro)).isTrue();
        assertThat(janela.contem(LocalDate.of(2026, 10, 10))).isTrue();
        assertThat(janela.contem(antes)).isFalse();
        assertThat(janela.atualOuProxima(antes)).isEqualTo(
                new JanelaFechamento.Intervalo(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 10)));
        assertThat(janela.atualOuProxima(dentro).inicio()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(janela.atualOuProxima(depois)).isEqualTo(
                new JanelaFechamento.Intervalo(LocalDate.of(2026, 11, 5), LocalDate.of(2026, 11, 10)));

        janela.exigirAberta(dentro);
        assertThatThrownBy(() -> janela.exigirAberta(depois))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessageContaining("do dia 5 ao dia 10")
                .hasMessageContaining("05/11/2026 a 10/11/2026");
    }
}
