package com.durvalcrm.venda.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** US-SALES-022: quem cancela cada venda. */
class QuemCancelaTest {

    private static Venda venda(long id, String vendedor, boolean pdv) {
        return Venda.reconstituir(id, id, vendedor, vendedor, pdv, Instant.parse("2026-10-27T13:00:00Z"),
                LocalDate.of(2026, 10, 27),
                List.of(new ItemVenda(1, "Café", TipoProduto.CANTINA, 1, new BigDecimal("3.50"))),
                List.of(new PagamentoVenda(MeioPagamento.DINHEIRO, 1, "Caixa", new BigDecimal("3.50"))), "k" + id, null,
                List.of(), 1L, StatusVenda.CONCLUIDA, null, null, null);
    }

    private static QuemCancela pdv(Long ultima) {
        return new QuemCancela("sub-pdv", false, false, false, true, ultima);
    }

    private static final QuemCancela TESOUREIRO = new QuemCancela("sub-tes", false, true, false, false, null);
    private static final QuemCancela VENDEDOR = new QuemCancela("sub-vend", false, false, true, false, null);
    private static final QuemCancela ADMINISTRADOR = new QuemCancela("sub-adm", true, false, false, false, null);

    private static void negado(QuemCancela quem, Venda v, String codigo) {
        assertThatThrownBy(() -> quem.exigirQuePodeCancelar(v))
                .isInstanceOfSatisfying(RegraDeNegocioException.class,
                        e -> assertThat(e.getCodigo()).isEqualTo(codigo));
    }

    @Test
    void pdvCancelaSoAPropriaUltimaVenda() {
        assertThatCode(() -> pdv(7L).exigirQuePodeCancelar(venda(7, "sub-pdv", true))).doesNotThrowAnyException();
        negado(pdv(7L), venda(6, "sub-pdv", true), "NAO_E_ULTIMA_VENDA_PDV");
        negado(pdv(7L), venda(7, "outro-pdv", true), "VENDA_DE_OUTRO_VENDEDOR");
    }

    /** A última já cancelada não libera a anterior: nada de cancelar em cadeia. */
    @Test
    void pdvComUltimaJaCanceladaNaoCancelaAAnterior() {
        negado(pdv(7L), venda(5, "sub-pdv", true), "NAO_E_ULTIMA_VENDA_PDV");
    }

    @Test
    void tesoureiroCancelaVendaDoPdvMasNaoADeUmVendedor() {
        assertThatCode(() -> TESOUREIRO.exigirQuePodeCancelar(venda(3, "sub-pdv", true))).doesNotThrowAnyException();
        negado(TESOUREIRO, venda(4, "sub-vend", false), "VENDA_DE_OUTRO_VENDEDOR");
    }

    @Test
    void vendedorCancelaAsQueFezEAdministradorQualquerUma() {
        assertThatCode(() -> VENDEDOR.exigirQuePodeCancelar(venda(4, "sub-vend", false))).doesNotThrowAnyException();
        negado(VENDEDOR, venda(3, "sub-pdv", true), "VENDA_DE_OUTRO_VENDEDOR");
        assertThatCode(() -> ADMINISTRADOR.exigirQuePodeCancelar(venda(4, "sub-vend", false)))
                .doesNotThrowAnyException();
        assertThatCode(() -> ADMINISTRADOR.exigirQuePodeCancelar(venda(3, "sub-pdv", true)))
                .doesNotThrowAnyException();
    }
}
