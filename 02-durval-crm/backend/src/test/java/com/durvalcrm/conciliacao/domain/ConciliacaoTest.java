package com.durvalcrm.conciliacao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class ConciliacaoTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 10, 20);
    private static final LocalDate CORTE = LocalDate.of(2026, 9, 1);
    private static final Lancamento.Autor AUTOR = new Lancamento.Autor("sub", "Carla", Instant.parse("2026-10-20T13:00:00Z"));
    private static final ContaFinanceira BANCO = conta(TipoConta.BANCO, true);

    private static ContaFinanceira conta(TipoConta tipo, boolean ativa) {
        return new ContaFinanceira(2, "banco-a", "Banco A", tipo, ativa, null, "BB", "1", "2", r("1000"), CORTE);
    }

    private static BigDecimal r(String v) {
        return new BigDecimal(v);
    }

    private static String campoDoErro(Runnable acao) {
        try {
            acao.run();
        } catch (ValidacaoException e) {
            return e.getErros().stream().map(ErroCampo::mensagem).findFirst().orElse("");
        }
        throw new AssertionError("Esperava erro de validação.");
    }

    /** Primeira sessão parte do saldo inicial; as seguintes, do extrato da anterior. */
    @Test
    void aberturaVemDoSaldoInicialOuDaSessaoAnterior() {
        Conciliacao primeira = Conciliacao.iniciar(BANCO, LocalDate.of(2026, 9, 30), r("1200"), null, HOJE, AUTOR);
        assertThat(primeira.getSaldoAbertura()).isEqualByComparingTo("1000");
        assertThat(primeira.getStatus()).isEqualTo(StatusConciliacao.EM_ANDAMENTO);

        Conciliacao segunda = Conciliacao.iniciar(BANCO, LocalDate.of(2026, 10, 15), r("900"),
                new Conciliacao.Anterior(LocalDate.of(2026, 9, 30), r("1200")), HOJE, AUTOR);
        assertThat(segunda.getSaldoAbertura()).isEqualByComparingTo("1200");
    }

    @Test
    void dataFinalDepoisDaAnteriorAteOntemENaoAntesDoCorte() {
        Conciliacao.Anterior anterior = new Conciliacao.Anterior(LocalDate.of(2026, 9, 30), r("1200"));
        assertThat(campoDoErro(() -> Conciliacao.iniciar(BANCO, LocalDate.of(2026, 9, 30), r("1"), anterior, HOJE, AUTOR)))
                .isEqualTo("Use uma data posterior à última conciliação (30/09/2026).");
        assertThat(campoDoErro(() -> Conciliacao.iniciar(BANCO, LocalDate.of(2026, 10, 21), r("1"), null, HOJE, AUTOR)))
                .isEqualTo("Use uma data até ontem (19/10/2026): o extrato de hoje só fecha amanhã.");
        // Hoje também não: o que for lançado depois da sessão, no mesmo dia, ficaria sem conciliação.
        assertThat(campoDoErro(() -> Conciliacao.iniciar(BANCO, HOJE, r("1"), null, HOJE, AUTOR)))
                .isEqualTo("Use uma data até ontem (19/10/2026): o extrato de hoje só fecha amanhã.");
        assertThat(Conciliacao.iniciar(BANCO, HOJE.minusDays(1), r("1"), null, HOJE, AUTOR).getDataFim())
                .isEqualTo(LocalDate.of(2026, 10, 19));
        assertThat(campoDoErro(() -> Conciliacao.iniciar(BANCO, LocalDate.of(2026, 8, 31), r("1"), null, HOJE, AUTOR)))
                .isEqualTo("A data é anterior à data de corte da conta (01/09/2026).");
        assertThat(campoDoErro(() -> Conciliacao.iniciar(BANCO, HOJE.minusDays(1), null, null, HOJE, AUTOR)))
                .isEqualTo("Informe o saldo final do extrato.");
    }

    /** Só contas bancárias; caixas usam o fechamento de caixa e Cartão a receber, a liquidação. */
    @Test
    void soContaBancariaAtiva() {
        assertThatThrownBy(() -> Conciliacao.iniciar(conta(TipoConta.CAIXA, true), HOJE, r("1"), null, HOJE, AUTOR))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Conciliacao.iniciar(conta(TipoConta.BANCO, false), HOJE, r("1"), null, HOJE, AUTOR))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessage("A conta Banco A está inativa.");
    }

    /** Diferença = extrato − (abertura + marcados); conclui só com zero e depois nada muda. */
    @Test
    void concluiSoComDiferencaZero() {
        Conciliacao c = Conciliacao.iniciar(BANCO, LocalDate.of(2026, 9, 30), r("1150.50"), null, HOJE, AUTOR);
        assertThat(c.diferenca(r("100"))).isEqualByComparingTo("50.50");
        assertThatThrownBy(() -> c.concluida(r("100"), AUTOR))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessageStartingWith("A diferença é de R$ 50,50");

        Conciliacao concluida = c.concluida(r("150.50"), AUTOR);
        assertThat(concluida.getStatus()).isEqualTo(StatusConciliacao.CONCLUIDA);
        assertThat(concluida.getConcluidaEm()).isEqualTo(AUTOR.em());
        assertThatThrownBy(concluida::exigirEmAndamento)
                .isInstanceOf(RegraDeNegocioException.class)
                .extracting(e -> ((RegraDeNegocioException) e).getCodigo()).isEqualTo("CONCILIACAO_CONCLUIDA");
        assertThatThrownBy(() -> concluida.comExtrato(BANCO, HOJE, r("1"), null, HOJE))
                .isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void lancamentoAdicionadoPrecisaCaberNoExtrato() {
        Conciliacao c = Conciliacao.iniciar(BANCO, LocalDate.of(2026, 9, 30), r("1000"), null, HOJE, AUTOR);
        c.exigirDentroDoExtrato(LocalDate.of(2026, 9, 30));
        assertThat(campoDoErro(() -> c.exigirDentroDoExtrato(LocalDate.of(2026, 10, 1))))
                .isEqualTo("Use uma data até o fim do extrato (30/09/2026).");
    }
}
