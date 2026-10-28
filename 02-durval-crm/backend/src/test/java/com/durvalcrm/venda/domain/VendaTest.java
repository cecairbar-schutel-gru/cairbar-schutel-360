package com.durvalcrm.venda.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class VendaTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");
    private static final ItemVenda LIVRO = new ItemVenda(1, "O Caminho", TipoProduto.LIVRO, 1, new BigDecimal("50.00"));
    private static final ItemVenda CAFE = new ItemVenda(2, "Café", TipoProduto.CANTINA, 2, new BigDecimal("3.50"));

    private static PagamentoVenda pag(MeioPagamento meio, String valor) {
        return new PagamentoVenda(meio, 1, "Conta", new BigDecimal(valor),
                meio == MeioPagamento.CARTAO ? TipoCartao.CREDITO : null);
    }

    private static Venda confirmar(List<ItemVenda> itens, List<PagamentoVenda> pagamentos) {
        return Venda.confirmar(itens, pagamentos, "sub", "Bruno", false, AGORA, LocalDate.of(2026, 10, 19), "k",
                null, () -> 1);
    }

    @Test
    void somaDosMeiosIgualAoTotalSeparaReceitaPorTipo() {
        Venda v = confirmar(List.of(LIVRO, CAFE), List.of(pag(MeioPagamento.DINHEIRO, "20"),
                pag(MeioPagamento.PIX, "37.00")));

        assertThat(v.total()).isEqualByComparingTo("57.00");
        assertThat(v.totalPorTipo(TipoProduto.LIVRO)).isEqualByComparingTo("50.00");
        assertThat(v.totalPorTipo(TipoProduto.CANTINA)).isEqualByComparingTo("7.00");
        assertThat(v.getNumero()).isEqualTo(1);
    }

    @Test
    void bloqueiaFaltaEExcesso() {
        assertThatThrownBy(() -> confirmar(List.of(LIVRO), List.of(pag(MeioPagamento.DINHEIRO, "40"))))
                .isInstanceOf(ValidacaoException.class)
                .satisfies(e -> assertThat(((ValidacaoException) e).getErros().getFirst().mensagem())
                        .isEqualTo("Faltam R$ 10,00 para fechar o total de R$ 50,00."));
        assertThatThrownBy(() -> confirmar(List.of(LIVRO), List.of(pag(MeioPagamento.DINHEIRO, "60"))))
                .isInstanceOf(ValidacaoException.class)
                .satisfies(e -> assertThat(((ValidacaoException) e).getErros().getFirst().mensagem())
                        .contains("o troco não entra"));
    }

    @Test
    void naoConsomeNumeroComVendaInvalida() {
        assertThatThrownBy(() -> Venda.confirmar(List.of(), List.of(), "sub", "Bruno", false, AGORA,
                LocalDate.of(2026, 10, 19), "k", null, () -> {
                    throw new AssertionError("não deveria pedir número");
                })).isInstanceOf(ValidacaoException.class);
    }

    /** Simulação de 27/10/2026, P9: crédito ou débito é obrigatório no cartão e só cabe nele. */
    @Test
    void cartaoExigeOTipoQueSoCabeNoCartao() {
        assertThatThrownBy(() -> confirmar(List.of(LIVRO),
                List.of(new PagamentoVenda(MeioPagamento.CARTAO, 1, "Cartão", new BigDecimal("50"), null))))
                .isInstanceOfSatisfying(ValidacaoException.class,
                        e -> assertThat(e.getErros().getFirst().campo()).isEqualTo("tipoCartao"));
        assertThatThrownBy(() -> confirmar(List.of(LIVRO),
                List.of(new PagamentoVenda(MeioPagamento.PIX, 1, "Banco", new BigDecimal("50"), TipoCartao.DEBITO))))
                .isInstanceOf(ValidacaoException.class);

        Venda v = confirmar(List.of(LIVRO), List.of(new PagamentoVenda(MeioPagamento.CARTAO, 1, "Cartão",
                new BigDecimal("50"), TipoCartao.DEBITO)));
        assertThat(v.getPagamentos().getFirst().tipoCartao()).isEqualTo(TipoCartao.DEBITO);
    }

    @Test
    void cancelarExigeMotivoEPreservaAVenda() {
        Venda v = confirmar(List.of(LIVRO), List.of(pag(MeioPagamento.CARTAO, "50")));
        assertThatThrownBy(() -> v.cancelar("curto", "Bruno", AGORA)).isInstanceOf(ValidacaoException.class);

        v.cancelar("Item registrado errado", "Bruno", AGORA);

        assertThat(v.getStatus()).isEqualTo(StatusVenda.CANCELADA);
        assertThat(v.total()).isEqualByComparingTo("50.00");
        assertThatThrownBy(() -> v.cancelar("Item registrado errado", "Bruno", AGORA))
                .isInstanceOf(RegraDeNegocioException.class);
    }
}
