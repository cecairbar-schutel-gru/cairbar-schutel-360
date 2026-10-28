package com.durvalcrm.intencaogasto.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IntencaoGastoTest {

    private static final Instant AGORA = Instant.parse("2026-10-21T13:00:00Z");
    private static final LocalDate HOJE = LocalDate.parse("2026-10-21");
    private static final Autor ANA = new Autor("sub-ana", "Ana", AGORA);
    private static final Autor CARLA = new Autor("sub-carla", "Carla", AGORA);
    private static final Categoria LIMPEZA = sub("DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "Material de limpeza",
            "DESPESAS_OPERACIONAIS", "Despesas operacionais");
    private static final Categoria CANTINA = sub("DESPESAS_COMERCIAIS.COMPRA_CANTINA", "Compra de produtos da cantina",
            "DESPESAS_COMERCIAIS", "Despesas comerciais");
    private static final Categoria TAXAS = sub("DESPESAS_COMERCIAIS.TAXAS_CARTAO", "Taxas de cartão",
            "DESPESAS_COMERCIAIS", "Despesas comerciais");
    private static final ContaFinanceira BANCO = conta(3, TipoConta.BANCO);
    private static final ContaFinanceira CAIXA = conta(1, TipoConta.CAIXA);

    private static Categoria sub(String codigo, String nome, String pai, String nomePai) {
        return new Categoria(codigo, nome, TipoCategoria.DESPESA, pai, nomePai, true);
    }

    private static ContaFinanceira conta(long id, TipoConta tipo) {
        return new ContaFinanceira(id, "c" + id, tipo == TipoConta.BANCO ? "Banco A" : "Caixa", tipo, true, null,
                null, null, null, BigDecimal.ZERO, HOJE.minusYears(1));
    }

    private static IntencaoGasto limpeza() {
        return IntencaoGasto.reconstituir(42L, "Produtos de limpeza", LIMPEZA.codigo(), new BigDecimal("180.00"),
                "Acabou o estoque", List.of(), StatusIntencao.PENDENTE, "sub-ana", "Ana", AGORA, AGORA, null, null,
                null, null, null, null, null, null, null, null, null, null, null);
    }

    private static IntencaoGasto compraAprovada() {
        IntencaoGasto i = IntencaoGasto.reconstituir(7L, "Reposição", CANTINA.codigo(), new BigDecimal("100.00"),
                "Semana de eventos", List.of(ItemCompra.pedido(1, "Café", 10), ItemCompra.pedido(2, "Suco", 5)),
                StatusIntencao.PENDENTE, "sub-ana", "Ana", AGORA, AGORA, null, null, null, null, null, null, null,
                null, null, null, null, null, null);
        i.aprovar(new BigDecimal("100.00"), CANTINA, MeioPagamentoGasto.DINHEIRO, CAIXA, HOJE, HOJE, null, CARLA);
        i.registrarLancamento(55);
        return i;
    }

    private static List<String> campos(ValidacaoException e) {
        return e.getErros().stream().map(ErroCampo::campo).toList();
    }

    @Test
    void novaExigeCamposESoAceitaCategoriasDisponiveis() {
        assertThatThrownBy(() -> IntencaoGasto.nova(" ", TAXAS, BigDecimal.ZERO, "", List.of(), ANA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e))
                        .containsExactly("descricao", "categoria", "valor", "justificativa"));
        IntencaoGasto nova = IntencaoGasto.nova("Produtos de limpeza", LIMPEZA, new BigDecimal("180.00"),
                "Acabou o estoque", List.of(), ANA);
        assertThat(nova.getStatus()).isEqualTo(StatusIntencao.PENDENTE);
        assertThat(nova.getNovosEventos()).singleElement()
                .satisfies(e -> assertThat(e.descricao()).contains("Despesas operacionais › Material de limpeza"));
    }

    @Test
    void compraDaCantinaExigeItensEAsDemaisNaoTem() {
        assertThatThrownBy(() -> IntencaoGasto.nova("Reposição", CANTINA, BigDecimal.TEN, "x", List.of(), ANA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("itens"));
        assertThatThrownBy(() -> IntencaoGasto.nova("Limpeza", LIMPEZA, BigDecimal.TEN, "x",
                List.of(ItemCompra.pedido(1, "Café", 1)), ANA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("itens"));
        assertThatThrownBy(() -> IntencaoGasto.nova("Reposição", CANTINA, BigDecimal.TEN, "x",
                List.of(ItemCompra.pedido(1, "Café", 1), ItemCompra.pedido(1, "Café", 2)), ANA))
                .isInstanceOf(ValidacaoException.class);
    }

    /** Exemplo da US-EXPENSE-004: R$ 180,00 aprovado por R$ 172,50 via PIX, com nota. */
    @Test
    void aprovacaoComAjusteExigeNotaEGeraLinhasDaDespesa() {
        IntencaoGasto i = limpeza();
        assertThatThrownBy(() -> i.aprovar(new BigDecimal("172.50"), LIMPEZA, MeioPagamentoGasto.PIX, BANCO, HOJE, HOJE,
                "", CARLA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("nota"));
        i.aprovar(new BigDecimal("172.50"), LIMPEZA, MeioPagamentoGasto.PIX, BANCO, HOJE, HOJE, "preço final", CARLA);
        assertThat(i.getStatus()).isEqualTo(StatusIntencao.APROVADA);
        assertThat(i.getAprovacao().linhasConta()).singleElement()
                .satisfies(l -> assertThat(l.valor()).isEqualByComparingTo("-172.50"));
        assertThat(i.getAprovacao().linhasCategoria()).singleElement()
                .satisfies(l -> assertThat(l.categoria()).isEqualTo(LIMPEZA.codigo()));
        assertThatThrownBy(() -> i.rejeitar("tarde", CARLA)).isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void meioDefineOTipoDeContaECartaoNaoExiste() {
        IntencaoGasto i = limpeza();
        assertThatThrownBy(() -> i.aprovar(new BigDecimal("180.00"), LIMPEZA, MeioPagamentoGasto.DINHEIRO, BANCO, HOJE,
                HOJE, null, CARLA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("contaId"));
        assertThatThrownBy(() -> i.aprovar(new BigDecimal("180.00"), LIMPEZA, MeioPagamentoGasto.BOLETO, BANCO,
                HOJE.plusDays(1), HOJE, null, CARLA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("data"));
        assertThatThrownBy(() -> i.aprovar(new BigDecimal("180.00"), CANTINA, MeioPagamentoGasto.PIX, BANCO, HOJE,
                HOJE, "mudou", CARLA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("categoria"));
    }

    @Test
    void retiradaSoPeloSolicitanteComMotivo() {
        IntencaoGasto i = limpeza();
        assertThatThrownBy(() -> i.retirar("não preciso", CARLA)).isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> i.retirar(" ", ANA)).isInstanceOf(ValidacaoException.class);
        i.retirar("Comprei com recurso próprio", ANA);
        assertThat(i.getStatus()).isEqualTo(StatusIntencao.CANCELADA);
    }

    @Test
    void recebimentoConferidoOuDivergente() {
        IntencaoGasto ok = compraAprovada();
        assertThat(ok.getStatus()).isEqualTo(StatusIntencao.AGUARDANDO_RECEBIMENTO);
        assertThat(ok.receber(Map.of(1L, 10, 2L, 5), null, ANA)).isTrue();
        assertThat(ok.getStatus()).isEqualTo(StatusIntencao.RECEBIDA);
        assertThatThrownBy(() -> ok.receber(Map.of(1L, 10, 2L, 5), null, ANA)).isInstanceOf(RegraDeNegocioException.class);

        IntencaoGasto diverge = compraAprovada();
        assertThatThrownBy(() -> diverge.receber(Map.of(1L, 8, 2L, 5), " ", ANA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(campos(e)).containsExactly("divergencia"));
        assertThatThrownBy(() -> diverge.receber(Map.of(1L, 8), "faltou", ANA)).isInstanceOf(ValidacaoException.class);
        assertThat(diverge.receber(Map.of(1L, 8, 2L, 5), "Vieram 8 cafés", ANA)).isFalse();
        assertThat(diverge.getStatus()).isEqualTo(StatusIntencao.DIVERGENTE);
        assertThat(diverge.getItens()).extracting(ItemCompra::quantidadeRecebida).containsExactly(8, 5);
    }

    @Test
    void correcaoVoltaAoRecebimentoECancelamentoDevolveODespesa() {
        IntencaoGasto i = compraAprovada();
        i.receber(Map.of(1L, 8, 2L, 0), "Faltou suco", ANA);
        assertThat(i.corrigir(Map.of(1L, 8, 2L, 0), new BigDecimal("80.00"), "Fornecedor devolveu", CARLA)).isTrue();
        assertThat(i.getStatus()).isEqualTo(StatusIntencao.AGUARDANDO_RECEBIMENTO);
        assertThat(i.getItens()).singleElement().satisfies(it -> {
            assertThat(it.quantidade()).isEqualTo(8);
            assertThat(it.quantidadeRecebida()).isNull();
        });
        assertThat(i.getAprovacao().valor()).isEqualByComparingTo("80.00");

        IntencaoGasto c = compraAprovada();
        c.receber(Map.of(1L, 0, 2L, 0), "Nada chegou", ANA);
        assertThatThrownBy(() -> c.corrigir(Map.of(1L, 0, 2L, 0), null, "x", CARLA)).isInstanceOf(ValidacaoException.class);
        assertThat(c.cancelarDivergente("Fornecedor não entregou", false, CARLA)).isEqualTo(55L);
        assertThat(c.getStatus()).isEqualTo(StatusIntencao.CANCELADA);
    }
}
