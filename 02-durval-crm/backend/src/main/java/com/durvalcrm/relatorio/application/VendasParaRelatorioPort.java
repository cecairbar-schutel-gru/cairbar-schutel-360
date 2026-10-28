package com.durvalcrm.relatorio.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Vendas para o relatório (US-REPORT-006). Implementada pelo módulo Vendas. */
public interface VendasParaRelatorioPort {

    /**
     * Vendas confirmadas no período (data financeira) e vendas canceladas no período (data do estorno),
     * estas com {@code cancelamento} verdadeiro e os mesmos itens e pagamentos da venda original.
     *
     * @param vendedorSubject só as vendas deste vendedor e as do PDV da cantina; nulo: todas
     */
    List<EventoVenda> eventos(LocalDate de, LocalDate ate, String vendedorSubject);

    record EventoVenda(long vendaId, LocalDate data, boolean cancelamento, String vendedorSubject, String vendedorNome,
            BigDecimal total, List<ItemVendido> itens, List<PagamentoVenda> pagamentos) {
    }

    /** {@code tipo}: LIVRO ou CANTINA; {@code valor} = quantidade × preço da venda. */
    record ItemVendido(long produtoId, String nome, String tipo, int quantidade, BigDecimal valor) {
    }

    /** {@code meio}: DINHEIRO, PIX, CARTAO_CREDITO, CARTAO_DEBITO ou CARTAO (tipo não informado, vendas antigas). */
    record PagamentoVenda(String meio, BigDecimal valor) {
    }
}
