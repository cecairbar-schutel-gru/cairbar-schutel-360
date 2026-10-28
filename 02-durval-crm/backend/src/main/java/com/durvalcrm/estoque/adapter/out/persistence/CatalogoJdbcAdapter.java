package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.domain.AlteracaoPreco;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.TipoProduto;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class CatalogoJdbcAdapter implements CatalogoRepository {

    private final JdbcClient jdbc;

    CatalogoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<ProdutoCatalogo> obter(long id) {
        return jdbc.sql("select * from produto where id = ?")
                .param(id)
                .query(CatalogoJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public List<ProdutoCatalogo> livrosDaEditora(long editoraId) {
        return jdbc.sql("select * from produto where tipo = 'LIVRO' and editora_id = ? order by nome, id")
                .param(editoraId)
                .query(CatalogoJdbcAdapter::mapear)
                .list();
    }

    private static ProdutoCatalogo mapear(ResultSet rs, int linha) throws SQLException {
        return ProdutoCatalogo.reconstituir(rs.getLong("id"), TipoProduto.valueOf(rs.getString("tipo")),
                rs.getString("nome"), rs.getString("categoria"), rs.getString("autor"), rs.getString("isbn"),
                rs.getObject("editora_id", Long.class), rs.getBigDecimal("preco"), rs.getBigDecimal("repasse_padrao"),
                rs.getBoolean("ativo"));
    }

    @Override
    public ProdutoCatalogo salvar(ProdutoCatalogo p) {
        if (p.getId() != null) {
            jdbc.sql("""
                    update produto set nome = :nome, categoria = :categoria, autor = :autor, isbn = :isbn,
                        editora_id = :editora, preco = :preco, repasse_padrao = :repasse, ativo = :ativo
                    where id = :id""")
                    .param("nome", p.getNome())
                    .param("categoria", p.getCategoria())
                    .param("autor", p.getAutor())
                    .param("isbn", p.getIsbn())
                    .param("editora", p.getEditoraId())
                    .param("preco", p.getPreco())
                    .param("repasse", p.getRepassePadrao())
                    .param("ativo", p.isAtivo())
                    .param("id", p.getId())
                    .update();
            return p;
        }
        long id = jdbc.sql("""
                insert into produto (tipo, nome, categoria, autor, isbn, editora_id, preco, repasse_padrao, ativo)
                values (:tipo, :nome, :categoria, :autor, :isbn, :editora, :preco, :repasse, :ativo)
                returning id""")
                .param("tipo", p.getTipo().name())
                .param("nome", p.getNome())
                .param("categoria", p.getCategoria())
                .param("autor", p.getAutor())
                .param("isbn", p.getIsbn())
                .param("editora", p.getEditoraId())
                .param("preco", p.getPreco())
                .param("repasse", p.getRepassePadrao())
                .param("ativo", p.isAtivo())
                .query(Long.class)
                .single();
        return obter(id).orElseThrow();
    }

    @Override
    public boolean isbnEmUso(String isbn, Long excetoId) {
        return jdbc.sql("select exists (select 1 from produto where isbn = ? and id is distinct from ?)")
                .params(isbn, excetoId)
                .query(Boolean.class)
                .single();
    }

    @Override
    public void excluir(long id) {
        jdbc.sql("delete from historico_preco where produto_id = ?").param(id).update();
        jdbc.sql("delete from lote_estoque where produto_id = ?").param(id).update();
        jdbc.sql("delete from produto where id = ?").param(id).update();
    }

    @Override
    public void registrarPreco(AlteracaoPreco a) {
        jdbc.sql("""
                insert into historico_preco (produto_id, preco_anterior, preco_novo, alterado_em, solicitado_por,
                    aprovado_por, motivo)
                values (?, ?, ?, ?, ?, ?, ?)""")
                .params(a.produtoId(), a.precoAnterior(), a.precoNovo(), Timestamp.from(a.alteradoEm()),
                        a.solicitadoPor(), a.aprovadoPor(), a.motivo())
                .update();
    }

    @Override
    public List<AlteracaoPreco> historicoPrecos(long produtoId) {
        return jdbc.sql("select * from historico_preco where produto_id = ? order by alterado_em desc, id desc")
                .param(produtoId)
                .query((rs, i) -> new AlteracaoPreco(rs.getLong("produto_id"), rs.getBigDecimal("preco_anterior"),
                        rs.getBigDecimal("preco_novo"), rs.getTimestamp("alterado_em").toInstant(),
                        rs.getString("solicitado_por"), rs.getString("aprovado_por"), rs.getString("motivo")))
                .list();
    }
}
