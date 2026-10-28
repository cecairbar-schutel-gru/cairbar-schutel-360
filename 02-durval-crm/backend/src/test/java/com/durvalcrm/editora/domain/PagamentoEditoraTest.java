package com.durvalcrm.editora.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PagamentoEditoraTest {

    private static final Instant AGORA = Instant.parse("2026-10-31T15:00:00Z");
    private static final LocalDate HOJE = LocalDate.parse("2026-10-31");
    private static final ContaFinanceira BANCO = conta(1, TipoConta.BANCO);
    private static final ContaFinanceira CAIXA = conta(2, TipoConta.CAIXA);

    private static ContaFinanceira conta(long id, TipoConta tipo) {
        return new ContaFinanceira(id, "c" + id, "Conta " + id, tipo, true, null, null, null, null, BigDecimal.ZERO,
                LocalDate.parse("2026-01-01"));
    }

    private static Obrigacao obrigacao(long id, String valor, String pago) {
        BigDecimal p = new BigDecimal(pago);
        return Obrigacao.reconstituir(id, 3, 10, 1, OrigemObrigacao.VENDA, id, 1, new BigDecimal(valor),
                new BigDecimal("100"), new BigDecimal(valor), p,
                p.signum() == 0 ? StatusObrigacao.ABERTA : StatusObrigacao.PARCIALMENTE_PAGA, AGORA, null);
    }

    private static PagamentoEditora pagar(List<Obrigacao> abertas, String valor, String credito, ContaFinanceira conta,
            MeioPagamentoEditora meio) {
        return PagamentoEditora.novo(3, HOJE, HOJE, new BigDecimal(valor), conta, meio, null, "chave", abertas,
                new BigDecimal(credito), "sub", "Carla", AGORA);
    }

    /** Exemplo da US-PUBLISHER-008: R$ 60,00 + R$ 17,50 em aberto; R$ 70,00 pagos deixam R$ 7,50. */
    @Test
    void alocaDaMaisAntigaParaAMaisNova() {
        List<Obrigacao> abertas = new ArrayList<>(List.of(obrigacao(1, "60.00", "0"), obrigacao(2, "17.50", "0")));
        PagamentoEditora p = pagar(abertas, "70.00", "0", BANCO, MeioPagamentoEditora.PIX);

        assertThat(p.getAlocacoes()).extracting(Alocacao::valor)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("60.00"), new BigDecimal("10.00"));
        assertThat(abertas.get(0).getStatus()).isEqualTo(StatusObrigacao.PAGA);
        assertThat(abertas.get(1).getStatus()).isEqualTo(StatusObrigacao.PARCIALMENTE_PAGA);
        assertThat(abertas.get(1).getValorAberto()).isEqualByComparingTo("7.50");
        assertThat(PagamentoEditora.saldoDevido(abertas, BigDecimal.ZERO)).isEqualByComparingTo("7.50");
    }

    @Test
    void valorNaoPassaOSaldoDevidoEMeioCombinaComAConta() {
        List<Obrigacao> abertas = new ArrayList<>(List.of(obrigacao(1, "60.00", "50.00")));
        assertThatThrownBy(() -> pagar(abertas, "10.01", "0", BANCO, MeioPagamentoEditora.PIX))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros().get(0).mensagem())
                        .isEqualTo("O valor passa o saldo devido de R$ 10,00."));
        assertThatThrownBy(() -> pagar(abertas, "10.00", "0", BANCO, MeioPagamentoEditora.DINHEIRO))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros().get(0).mensagem())
                        .isEqualTo("Pagamento em dinheiro sai de um caixa."));
        assertThat(pagar(abertas, "10.00", "0", CAIXA, MeioPagamentoEditora.DINHEIRO).getContaId()).isEqualTo(2);
    }

    @Test
    void creditoDisponivelEhAplicadoAntesDoDinheiro() {
        List<Obrigacao> abertas = new ArrayList<>(List.of(obrigacao(1, "40.00", "0")));
        assertThat(PagamentoEditora.saldoDevido(abertas, new BigDecimal("15.00"))).isEqualByComparingTo("25.00");
        PagamentoEditora p = pagar(abertas, "25.00", "15.00", BANCO, MeioPagamentoEditora.TRANSFERENCIA);
        assertThat(p.getCreditoAplicado()).isEqualByComparingTo("15.00");
        assertThat(p.getAlocacoes().get(0).valor()).isEqualByComparingTo("40.00");
        assertThat(abertas.get(0).getStatus()).isEqualTo(StatusObrigacao.PAGA);
    }

    @Test
    void semSaldoDevidoNaoHaPagamento() {
        List<Obrigacao> abertas = new ArrayList<>(List.of(obrigacao(1, "10.00", "0")));
        assertThatThrownBy(() -> pagar(abertas, "1.00", "10.00", BANCO, MeioPagamentoEditora.PIX))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessage("Não há saldo devido a esta editora.");
    }

    @Test
    void reabrirDesfazAParteDoPagamentoEstornado() {
        Obrigacao o = obrigacao(1, "60.00", "0");
        o.pagar(new BigDecimal("60.00"));
        o.reabrir(new BigDecimal("20.00"));
        assertThat(o.getStatus()).isEqualTo(StatusObrigacao.PARCIALMENTE_PAGA);
        o.reabrir(new BigDecimal("40.00"));
        assertThat(o.getStatus()).isEqualTo(StatusObrigacao.ABERTA);
        assertThat(o.getValorAberto()).isEqualByComparingTo("60.00");
    }
}
