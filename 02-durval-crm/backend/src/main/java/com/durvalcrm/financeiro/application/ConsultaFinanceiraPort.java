package com.durvalcrm.financeiro.application;

import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Consultas de leitura do Financeiro (saldos, listagem, painel), feitas direto no banco. */
public interface ConsultaFinanceiraPort {

    /** Saldo de cada conta: saldo inicial mais as linhas até {@code data} (todas, se nulo). */
    Map<Long, BigDecimal> saldos(LocalDate data);

    /**
     * Soma das linhas da conta (a partir do corte) por tipo de cartão; as linhas sem tipo ficam de fora.
     * Usada para dividir o saldo de Cartão a receber em crédito e débito.
     */
    Map<TipoCartao, BigDecimal> somaPorTipoCartao(long contaId);

    /** Saldo inicial mais as linhas da conta com data anterior a {@code data}. */
    BigDecimal saldoAntesDe(long contaId, LocalDate data);

    /**
     * Página de lançamentos já filtrada, na ordem de data e id. Com conta, o saldo depois de cada
     * lançamento parte do saldo anterior ao período (que nunca começa antes da data de corte).
     */
    List<LinhaPagina> pagina(FiltroLancamentos filtro, int deslocamento, int limite);

    /** Soma das linhas da conta no período (sem os demais filtros); {@code ate} nulo: sem limite. */
    BigDecimal somaNoPeriodo(long contaId, LocalDate de, LocalDate ate);

    /** Id do estorno de cada lançamento estornado entre os informados. */
    Map<Long, Long> estornos(Collection<Long> lancamentos);

    /** Lançamentos de correção registrados para o lançamento estornado. */
    List<Long> correcoes(long lancamentoId);

    /** Lançamentos com linha bancária ainda não conciliada, por conta bancária. */
    Map<Long, Long> naoConciliadosPorBanco();

    /** Estornos de contribuições e vendas registrados desde o instante. */
    List<Cancelamento> cancelamentosDesde(Instant desde);

    /** Receitas, despesas e taxas de cartão no período, pela classificação atual. */
    ResumoPeriodo resumo(LocalDate de, LocalDate ate);

    /** Despesas da subcategoria no período, pela classificação atual e já descontados os estornos. */
    BigDecimal despesasDaCategoria(String categoria, LocalDate de, LocalDate ate);

    /**
     * Soma das linhas de categoria no período, por subcategoria e pela classificação atual: receitas
     * positivas, despesas negativas; os estornos entram com sinal invertido na data em que foram lançados.
     */
    Map<String, BigDecimal> somaPorCategoria(LocalDate de, LocalDate ate);

    /**
     * Movimento de cada conta no período: transferências internas e liquidações de cartão (e os estornos
     * delas) separadas das demais entradas e saídas.
     */
    List<MovimentoConta> movimentoPorConta(LocalDate de, LocalDate ate);

    /**
     * Linhas de conta e de categoria de cada lançamento do período (inclusive estornos, na data em que
     * foram lançados), pela classificação atual: base do fluxo de caixa (US-REPORT-001).
     */
    List<LinhasDoLancamento> linhasNoPeriodo(LocalDate de, LocalDate ate);

    /** Data da última liquidação de cartão até a data (estornos não contam). */
    Optional<LocalDate> ultimaLiquidacaoCartao(LocalDate ate);

    /**
     * @param saldoApos  saldo da conta filtrada depois deste lançamento (nulo sem conta)
     * @param conciliado a linha da conta filtrada já foi conciliada (nulo sem conta)
     */
    record LinhaPagina(long id, BigDecimal saldoApos, Boolean conciliado) {
    }

    record Cancelamento(long lancamentoId, LocalDate data, Instant registradoEm, String origemTipo, Long origemId,
            String descricao, BigDecimal valor, String registradoPor) {
    }

    record ResumoPeriodo(BigDecimal receitas, BigDecimal despesas, BigDecimal taxasCartao) {
    }

    /** Valores positivos; {@code saidas} e {@code transferenciasSaida} já sem o sinal. */
    record MovimentoConta(long contaId, BigDecimal entradas, BigDecimal saidas, BigDecimal transferenciasEntrada,
            BigDecimal transferenciasSaida) {
    }

    /** Valores com o sinal gravado, somados por conta e por subcategoria. */
    record LinhasDoLancamento(long id, LocalDate data, Map<Long, BigDecimal> contas, Map<String, BigDecimal> categorias) {
    }
}
