package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.estoque.domain.ProdutoRepository;
import com.durvalcrm.estoque.domain.TipoProduto;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ProdutoJdbcAdapter implements ProdutoRepository {

    private static final String SELECT = """
            select p.id, p.tipo, p.nome, p.categoria, p.autor, p.isbn, p.preco, p.ativo,
                   coalesce((select sum(l.quantidade) from lote_estoque l where l.produto_id = p.id), 0) as saldo
            from produto p
            """;

    private final JdbcClient jdbc;

    ProdutoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Produto> buscarAtivos(String termoNormalizado, String isbn, TipoProduto tipo, int limite) {
        return jdbc.sql(SELECT + """
                where p.ativo
                  and (cast(:tipo as varchar) is null or p.tipo = :tipo)
                  and (p.texto_busca like '%' || :termo || '%' or p.isbn = cast(:isbn as varchar))
                order by p.nome, p.id
                limit :limite""")
                .param("tipo", tipo == null ? null : tipo.name())
                .param("termo", termoNormalizado.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_"))
                .param("isbn", isbn)
                .param("limite", limite)
                .query(ProdutoJdbcAdapter::mapear)
                .list();
    }

    @Override
    public List<Produto> buscarPorIds(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        List<Long> ordem = List.copyOf(ids);
        return jdbc.sql(SELECT + "where p.id in (:ids)")
                .param("ids", ordem)
                .query(ProdutoJdbcAdapter::mapear)
                .list().stream()
                .sorted(Comparator.comparingInt(p -> ordem.indexOf(p.id())))
                .toList();
    }

    private static Produto mapear(ResultSet rs, int linha) throws SQLException {
        return new Produto(rs.getLong("id"), TipoProduto.valueOf(rs.getString("tipo")), rs.getString("nome"),
                rs.getString("categoria"), rs.getString("autor"), rs.getString("isbn"), rs.getBigDecimal("preco"),
                rs.getBoolean("ativo"), rs.getInt("saldo"));
    }
}
