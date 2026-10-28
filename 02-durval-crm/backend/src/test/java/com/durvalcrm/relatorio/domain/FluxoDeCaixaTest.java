package com.durvalcrm.relatorio.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.durvalcrm.relatorio.domain.FluxoDeCaixa.Parcela;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class FluxoDeCaixaTest {

    static final long CAIXA = 1;
    static final long BANCO = 2;
    static final long CARTAO = 3;
    static final String MENSALIDADES = "RECEITAS_CONTRIBUICOES.MENSALIDADES";
    static final String DOACOES = "RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS";
    static final String TAXAS = "DESPESAS_COMERCIAIS.TAXAS_CARTAO";
    static final Set<String> RECEITAS = Set.of(MENSALIDADES, DOACOES);
    static final LocalDate DIA = LocalDate.of(2026, 10, 10);

    /** Contribuição de R$ 120 (100 de mensalidades + 20 de doação) em dinheiro (70) e cartão (50). */
    static final MovimentoRazao CONTRIBUICAO = new MovimentoRazao(1, DIA, Map.of(CAIXA, 7000L, CARTAO, 5000L),
            Map.of(MENSALIDADES, 10000L, DOACOES, 2000L));
    /** Liquidação: bruto 50 sai de Cartão a receber, líquido 48 entra no banco, taxa 2. */
    static final MovimentoRazao LIQUIDACAO = new MovimentoRazao(2, DIA, Map.of(CARTAO, -5000L, BANCO, 4800L),
            Map.of(TAXAS, -200L));
    static final MovimentoRazao TRANSFERENCIA = new MovimentoRazao(3, DIA, Map.of(CAIXA, -2000L, BANCO, 2000L), Map.of());

    @Test
    void todasAsContasExplicamOMovimentoPorCategoriaETransferencia() {
        FluxoDeCaixa f = new FluxoDeCaixa(Set.of(CAIXA, BANCO, CARTAO), RECEITAS);
        Parcela p = f.somarTodos(List.of(CONTRIBUICAO, LIQUIDACAO, TRANSFERENCIA));
        assertThat(f.entradas()).containsEntry(MENSALIDADES, 10000L).containsEntry(DOACOES, 2000L);
        assertThat(f.saidas()).containsEntry(TAXAS, 200L);
        // Entre as contas escolhidas, a transferência aparece nos dois sentidos.
        assertThat(p.transferenciasEntrada()).isEqualTo(6800);
        assertThat(p.transferenciasSaida()).isEqualTo(6800);
        assertThat(p.liquido()).isEqualTo(7000 + 5000 - 5000 + 4800);
    }

    @Test
    void cadaContaLevaASuaParteDaReceita() {
        FluxoDeCaixa f = new FluxoDeCaixa(Set.of(CAIXA), RECEITAS);
        Parcela p = f.somarTodos(List.of(CONTRIBUICAO, TRANSFERENCIA));
        // 70 de 120: 58,33 de mensalidades e 11,67 de doação.
        assertThat(f.entradas()).containsEntry(MENSALIDADES, 5833L).containsEntry(DOACOES, 1167L);
        assertThat(p.transferenciasSaida()).isEqualTo(2000);
        assertThat(p.liquido()).isEqualTo(7000 - 2000);
    }

    @Test
    void naLiquidacaoATaxaSaiDeCartaoAReceberEOLiquidoETransferencia() {
        FluxoDeCaixa cartao = new FluxoDeCaixa(Set.of(CARTAO), RECEITAS);
        Parcela p = cartao.somar(LIQUIDACAO);
        assertThat(p.saidas()).isEqualTo(200);
        assertThat(p.transferenciasSaida()).isEqualTo(4800);
        FluxoDeCaixa banco = new FluxoDeCaixa(Set.of(BANCO), RECEITAS);
        Parcela b = banco.somar(LIQUIDACAO);
        assertThat(b.saidas()).isZero();
        assertThat(b.transferenciasEntrada()).isEqualTo(4800);
    }

    @Test
    void estornoDescontaACategoriaOriginal() {
        MovimentoRazao estorno = new MovimentoRazao(4, DIA.plusDays(1), Map.of(CAIXA, -7000L, CARTAO, -5000L),
                Map.of(MENSALIDADES, -10000L, DOACOES, -2000L));
        FluxoDeCaixa f = new FluxoDeCaixa(Set.of(CAIXA, CARTAO), RECEITAS);
        Parcela p = f.somarTodos(List.of(CONTRIBUICAO, estorno));
        assertThat(f.entradas()).containsEntry(MENSALIDADES, 0L).containsEntry(DOACOES, 0L);
        assertThat(p.liquido()).isZero();
    }
}
