package com.durvalcrm.financeiro.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class OperacoesFinanceirasTest {

    private static final LocalDate CORTE = LocalDate.of(2026, 10, 1);
    private static final ContaFinanceira CAIXA = conta(1, TipoConta.CAIXA);
    private static final ContaFinanceira BANCO = conta(2, TipoConta.BANCO);
    private static final ContaFinanceira CARTAO = conta(3, TipoConta.CARTAO_A_RECEBER);
    private static final Lancamento.Autor AUTOR = new Lancamento.Autor("sub", "Carla", Instant.parse("2026-10-20T13:00:00Z"));

    private static ContaFinanceira conta(long id, TipoConta tipo) {
        return new ContaFinanceira(id, "c" + id, "Conta " + id, tipo, true, null, null, null, null, BigDecimal.ZERO, CORTE);
    }

    private static BigDecimal r(String v) {
        return new BigDecimal(v);
    }

    /** Exemplo da US-FINANCIAL-004. */
    @Test
    void liquidacaoSeparaBrutoTaxaELiquido() {
        LiquidacaoCartao l = LiquidacaoCartao.de(r("600"), r("18"), r("1000"));
        assertThat(l.liquido()).isEqualByComparingTo("582");
        assertThat(l.linhasConta(CARTAO, BANCO)).containsExactly(new LinhaConta(3, r("-600")), new LinhaConta(2, r("582")));
        assertThat(l.linhasCategoria()).containsExactly(new LinhaCategoria(CategoriaFinanceira.TAXAS_CARTAO, r("-18")));
        Lancamento lanc = Lancamento.novo(LocalDate.of(2026, 10, 20), OrigemLancamento.LIQUIDACAO_CARTAO, null, "x", AUTOR,
                l.linhasConta(CARTAO, BANCO), l.linhasCategoria(), null);
        assertThat(lanc.natureza()).isEqualTo(NaturezaLancamento.LIQUIDACAO);

        assertThatThrownBy(() -> LiquidacaoCartao.de(r("450"), r("10"), r("400")))
                .isInstanceOf(RegraDeNegocioException.class)
                .hasMessage("O bruto de R$ 450,00 excede o saldo de Cartão a receber de R$ 400,00.");
        assertThatThrownBy(() -> LiquidacaoCartao.de(r("10"), r("10"), r("400"))).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> LiquidacaoCartao.de(r("10"), r("-1"), r("400"))).isInstanceOf(ValidacaoException.class);
        assertThat(LiquidacaoCartao.de(r("10"), r("0"), r("400")).linhasCategoria()).isEmpty();
    }

    /** O tipo liquidado vai só na linha de Cartão a receber; o limite continua sendo o saldo total. */
    @Test
    void liquidacaoComTipoMarcaALinhaDoCartao() {
        LiquidacaoCartao l = LiquidacaoCartao.de(r("600"), r("18"), TipoCartao.DEBITO, r("1000"));
        assertThat(l.linhasConta(CARTAO, BANCO)).containsExactly(new LinhaConta(3, r("-600"), TipoCartao.DEBITO),
                new LinhaConta(2, r("582")));
    }

    @Test
    void transferenciaNaoTemCategoriaENaoUsaCartao() {
        List<LinhaConta> linhas = Transferencia.linhas(CAIXA, BANCO, r("50"));
        Lancamento l = Lancamento.novo(CORTE, OrigemLancamento.TRANSFERENCIA, null, "x", AUTOR, linhas, List.of(), null);
        assertThat(l.natureza()).isEqualTo(NaturezaLancamento.TRANSFERENCIA);
        assertThat(l.valorNaConta(1)).isEqualByComparingTo("-50");
        Lancamento gravado = Lancamento.reconstituir(7L, CORTE, OrigemLancamento.TRANSFERENCIA, null, "x", "sub", null,
                AUTOR.em(), null, null, null, null, null, linhas, List.of());
        Lancamento estorno = gravado.estorno(CORTE, "Estorno", "motivo", AUTOR);
        assertThat(estorno.natureza()).isEqualTo(NaturezaLancamento.ESTORNO);
        assertThat(estorno.valorNaConta(1)).isEqualByComparingTo("50");
        assertThatThrownBy(() -> Transferencia.linhas(CARTAO, BANCO, r("1"))).isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> Transferencia.linhas(BANCO, BANCO, r("1"))).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Transferencia.linhas(CAIXA, BANCO, r("0"))).isInstanceOf(ValidacaoException.class);
    }

    @Test
    void lancamentoManualRecusaCategoriaDeFluxoProprioOuDeOutroTipo() {
        Categoria agua = new Categoria("DESPESAS_OPERACIONAIS.AGUA", "Água", TipoCategoria.DESPESA,
                "DESPESAS_OPERACIONAIS", "Despesas operacionais", true);
        Categoria taxas = new Categoria(CategoriaFinanceira.TAXAS_CARTAO, "Taxas de cartão", TipoCategoria.DESPESA,
                "DESPESAS_COMERCIAIS", "Despesas comerciais", true);
        LancamentoManual m = LancamentoManual.de(TipoCategoria.DESPESA, agua, r("80"), "  Conta   de água ");
        assertThat(m.descricao()).isEqualTo("Conta de água");
        assertThat(m.linhasConta(BANCO)).containsExactly(new LinhaConta(2, r("-80")));
        assertThatThrownBy(() -> LancamentoManual.de(TipoCategoria.DESPESA, taxas, r("1"), "x"))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> LancamentoManual.de(TipoCategoria.RECEITA, agua, r("1"), "x"))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void contaRespeitaDataDeCorteSaldoInicialEInativacao() {
        ContaFinanceira.Dados dados = new ContaFinanceira.Dados("Caixa", null, null, null, null, r("10"), CORTE);
        assertThatThrownBy(() -> CAIXA.exigirDataAPartirDoCorte(CORTE.minusDays(1)))
                .isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> CAIXA.alterada(dados, true)).isInstanceOf(RegraDeNegocioException.class);
        assertThat(CAIXA.alterada(dados, false).saldoInicial()).isEqualByComparingTo("10");
        assertThatThrownBy(() -> CAIXA.inativada(r("0.01"))).isInstanceOf(RegraDeNegocioException.class);
        assertThat(CAIXA.inativada(BigDecimal.ZERO).ativa()).isFalse();
        assertThatThrownBy(() -> CARTAO.inativada(BigDecimal.ZERO)).isInstanceOf(RegraDeNegocioException.class);
        assertThatThrownBy(() -> ContaFinanceira.nova(TipoConta.CAIXA, "Caixa Central!", dados))
                .isInstanceOf(ValidacaoException.class);
        assertThat(CAIXA.podeFicarNegativa()).isFalse();
        assertThat(BANCO.podeFicarNegativa()).isTrue();
    }

}
