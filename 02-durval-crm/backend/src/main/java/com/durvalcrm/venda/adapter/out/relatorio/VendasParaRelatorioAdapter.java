package com.durvalcrm.venda.adapter.out.relatorio;

import com.durvalcrm.relatorio.application.VendasParaRelatorioPort;
import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Vendas e cancelamentos do período para o relatório de vendas (US-REPORT-006). */
@Component
class VendasParaRelatorioAdapter implements VendasParaRelatorioPort {

    private final JdbcClient jdbc;

    VendasParaRelatorioAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private record Evento(long vendaId, LocalDate data, boolean cancelamento, String vendedorSubject, String vendedorNome,
            BigDecimal total) {
    }

    @Override
    public List<EventoVenda> eventos(LocalDate de, LocalDate ate, String vendedorSubject) {
        String filtroVendedor = vendedorSubject == null ? "" : " and (v.vendedor_subject = :vendedor or v.pdv)";
        var consulta = jdbc.sql("""
                select v.id, v.data_financeira as data, false as cancelamento, v.vendedor_subject, v.vendedor_nome, v.total
                from venda v where v.data_financeira between :de and :ate""" + filtroVendedor + """

                union all
                select v.id, e.data_financeira, true, v.vendedor_subject, v.vendedor_nome, v.total
                from venda v join lancamento_financeiro e on e.estorna_lancamento_id = v.lancamento_id
                where v.status = 'CANCELADA' and e.data_financeira between :de and :ate""" + filtroVendedor + """

                order by 2, 1""")
                .param("de", Date.valueOf(de))
                .param("ate", Date.valueOf(ate));
        if (vendedorSubject != null) {
            consulta = consulta.param("vendedor", vendedorSubject);
        }
        List<Evento> eventos = consulta.query((rs, i) -> new Evento(rs.getLong("id"), rs.getDate("data").toLocalDate(),
                rs.getBoolean("cancelamento"), rs.getString("vendedor_subject"), rs.getString("vendedor_nome"),
                rs.getBigDecimal("total"))).list();
        if (eventos.isEmpty()) {
            return List.of();
        }
        List<Long> ids = eventos.stream().map(Evento::vendaId).distinct().toList();
        Map<Long, List<ItemVendido>> itens = new HashMap<>();
        jdbc.sql("""
                select venda_id, produto_id, produto_nome, tipo, quantidade, quantidade * preco_unitario as valor
                from venda_item where venda_id in (:ids) order by venda_id, ordem""")
                .param("ids", ids)
                .query(rs -> {
                    itens.computeIfAbsent(rs.getLong("venda_id"), k -> new ArrayList<>()).add(new ItemVendido(
                            rs.getLong("produto_id"), rs.getString("produto_nome"), rs.getString("tipo"),
                            rs.getInt("quantidade"), rs.getBigDecimal("valor")));
                });
        Map<Long, List<PagamentoVenda>> pagamentos = new HashMap<>();
        jdbc.sql("""
                select venda_id, case when meio = 'CARTAO' and tipo_cartao is not null then 'CARTAO_' || tipo_cartao
                                      else meio end as meio, valor
                from venda_pagamento where venda_id in (:ids) order by venda_id, ordem""")
                .param("ids", ids)
                .query(rs -> {
                    pagamentos.computeIfAbsent(rs.getLong("venda_id"), k -> new ArrayList<>())
                            .add(new PagamentoVenda(rs.getString("meio"), rs.getBigDecimal("valor")));
                });
        return eventos.stream().map(e -> new EventoVenda(e.vendaId(), e.data(), e.cancelamento(), e.vendedorSubject(),
                e.vendedorNome(), e.total(), itens.getOrDefault(e.vendaId(), List.of()),
                pagamentos.getOrDefault(e.vendaId(), List.of()))).toList();
    }
}
