package com.durvalcrm.editora.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RemessaTest {

    private static final Instant AGORA = Instant.parse("2026-10-21T13:00:00Z");
    private static final LocalDate HOJE = LocalDate.parse("2026-10-21");
    private static final Editora LUZ = new Editora(3L, "Editora Luz", "11222333000181", null, null, null,
            Editora.DadosPagamento.NENHUM, null, true);
    private static final Map<Long, TituloConsignado> TITULOS = Map.of(
            1L, new TituloConsignado(1, "O Caminho", null, null, 3L, new BigDecimal("40"), true),
            2L, new TituloConsignado(2, "Nosso Lar", null, null, 3L, null, true),
            9L, new TituloConsignado(9, "De outra", null, null, 4L, new BigDecimal("30"), true));

    private static Remessa nova(List<Remessa.ItemPedido> itens) {
        return Remessa.nova(LUZ, HOJE, " NF 10 ", itens, TITULOS, HOJE, "Daniel", AGORA);
    }

    @Test
    void percentualVemDoPadraoDoTituloQuandoNaoInformado() {
        Remessa r = nova(List.of(new Remessa.ItemPedido(1L, 3, null), new Remessa.ItemPedido(2L, 2, new BigDecimal("35.5"))));
        assertThat(r.getItens()).extracting(Remessa.Item::repassePercentual)
                .usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("40"), new BigDecimal("35.5"));
        assertThat(r.getNumeroDocumento()).isEqualTo("NF 10");
        assertThat(Remessa.codigo(2026, 7)).isEqualTo("R-2026-0007");
    }

    @Test
    void validaTituloDaEditoraQuantidadeEPercentual() {
        assertThatThrownBy(() -> nova(List.of(new Remessa.ItemPedido(9L, 1, null), new Remessa.ItemPedido(2L, 1, null),
                new Remessa.ItemPedido(1L, 0, null))))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros())
                        .extracting(ErroCampo::mensagem)
                        .containsExactly("O título não é da editora Editora Luz.",
                                "Informe o percentual de repasse de Nosso Lar.",
                                "Informe a quantidade de O Caminho (maior que zero)."));
        assertThatThrownBy(() -> nova(List.of(new Remessa.ItemPedido(1L, 1, new BigDecimal("100.001")))))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> nova(List.of()))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros().get(0).campo())
                        .isEqualTo("itens"));
    }

    @Test
    void editoraInativaNaoRecebeRemessa() {
        assertThatThrownBy(() -> Remessa.nova(LUZ.inativada(), HOJE, null, List.of(new Remessa.ItemPedido(1L, 1, null)),
                TITULOS, HOJE, "Daniel", AGORA))
                .isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void devolucaoNaoPassaORestanteDaRemessa() {
        Remessa r = Remessa.reconstituir(5L, "R-2026-0001", 3, HOJE.minusDays(5), null, StatusRemessa.ABERTA,
                List.of(new Remessa.Item(1, 5, new BigDecimal("40"))), AGORA, "Daniel", null, null, null);
        assertThatThrownBy(() -> Devolucao.nova(r, HOJE, null, Map.of(1L, 4), Map.of(1L, 3), Map.of(1L, "O Caminho"),
                HOJE, "sub", "Daniel", AGORA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros().get(0).mensagem())
                        .isEqualTo("Restam só 3 unidade(s) de O Caminho nesta remessa."));
        assertThatThrownBy(() -> Devolucao.nova(r, HOJE.minusDays(6), null, Map.of(1L, 1), Map.of(1L, 3),
                Map.of(1L, "O Caminho"), HOJE, "sub", "Daniel", AGORA))
                .isInstanceOf(ValidacaoException.class);
        Devolucao d = Devolucao.nova(r, HOJE, "  ", Map.of(1L, 3), Map.of(1L, 3), Map.of(1L, "O Caminho"), HOJE, "sub",
                "Daniel", AGORA);
        assertThat(d.itens()).containsExactly(new Devolucao.Item(1, 3));
        assertThat(d.observacao()).isNull();
    }
}
