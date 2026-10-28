package com.durvalcrm.estoque.adapter.out.relatorio;

import com.durvalcrm.relatorio.application.EstoqueParaRelatorioPort;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Produtos, lotes e movimentos para o relatório de estoque e a folha de contagem (US-REPORT-007). */
@Component
class EstoqueParaRelatorioAdapter implements EstoqueParaRelatorioPort {

    private final JdbcClient jdbc;

    EstoqueParaRelatorioAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ProdutoEstoque> produtos(String tipo, String categoria, Long editoraId) {
        StringBuilder sql = new StringBuilder("""
                select p.id, p.tipo, p.nome, p.categoria, p.autor, p.editora_id, e.nome as editora_nome, p.ativo
                from produto p left join editora e on e.id = p.editora_id where true""");
        Map<String, Object> params = new LinkedHashMap<>();
        if (tipo != null) {
            sql.append(" and p.tipo = :tipo");
            params.put("tipo", tipo);
        }
        if (categoria != null) {
            sql.append(" and lower(p.categoria) = lower(:categoria)");
            params.put("categoria", categoria);
        }
        if (editoraId != null) {
            sql.append(" and p.editora_id = :editora");
            params.put("editora", editoraId);
        }
        sql.append(" order by p.tipo, lower(p.nome), p.id");
        return jdbc.sql(sql.toString()).params(params)
                .query((rs, i) -> new ProdutoEstoque(rs.getLong("id"), rs.getString("tipo"), rs.getString("nome"),
                        rs.getString("categoria"), rs.getString("autor"), rs.getObject("editora_id", Long.class),
                        rs.getString("editora_nome"), rs.getBoolean("ativo")))
                .list();
    }

    @Override
    public List<LoteEstoque> lotes(Collection<Long> produtos) {
        return jdbc.sql("""
                select l.produto_id, l.remessa_id, r.codigo, r.editora_id, e.nome as editora_nome, l.quantidade
                from lote_estoque l
                left join remessa r on r.id = l.remessa_id
                left join editora e on e.id = r.editora_id
                where l.produto_id in (:ids) order by l.produto_id, r.recebida_em nulls first, l.remessa_id""")
                .param("ids", new ArrayList<>(produtos))
                .query((rs, i) -> new LoteEstoque(rs.getLong("produto_id"), rs.getObject("remessa_id", Long.class),
                        rs.getString("codigo"), rs.getObject("editora_id", Long.class), rs.getString("editora_nome"),
                        rs.getInt("quantidade")))
                .list();
    }

    @Override
    public List<SomaMovimentos> movimentos(Collection<Long> produtos, Instant inicio, Instant fim) {
        return jdbc.sql("""
                select m.produto_id, m.remessa_id, m.tipo, o.tipo as tipo_estornado,
                       coalesce(sum(m.quantidade) filter (where m.ocorrido_em < :fim), 0) as no_periodo,
                       coalesce(sum(m.quantidade) filter (where m.ocorrido_em >= :fim), 0) as depois
                from movimento_estoque m
                left join movimento_estoque o on o.id = m.estorna_movimento_id
                where m.produto_id in (:ids) and m.ocorrido_em >= :inicio
                group by m.produto_id, m.remessa_id, m.tipo, o.tipo""")
                .param("ids", new ArrayList<>(produtos))
                .param("inicio", Timestamp.from(inicio))
                .param("fim", Timestamp.from(fim))
                .query((rs, i) -> new SomaMovimentos(rs.getLong("produto_id"), rs.getObject("remessa_id", Long.class),
                        rs.getString("tipo"), rs.getString("tipo_estornado"), rs.getInt("no_periodo"), rs.getInt("depois")))
                .list();
    }
}
