package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.Lote;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.TipoMovimento;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Lotes e movimentos de estoque. A ordem FIFO usa a data de recebimento e o código da remessa
 * (tabela do módulo Editoras, no mesmo banco).
 */
@Component
class EstoqueJdbcAdapter implements EstoqueRepository {

    private static final String LOTES = """
            select l.produto_id, l.remessa_id, r.codigo, l.quantidade
            from lote_estoque l left join remessa r on r.id = l.remessa_id
            where l.produto_id = :produto
            order by l.remessa_id is not null, r.recebida_em, r.codigo
            """;

    private final JdbcClient jdbc;

    EstoqueJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Lote> travarLotes(long produtoId) {
        return lotes(LOTES + "for update of l", produtoId);
    }

    @Override
    public List<Lote> lotes(long produtoId) {
        return lotes(LOTES, produtoId);
    }

    private List<Lote> lotes(String sql, long produtoId) {
        return jdbc.sql(sql)
                .param("produto", produtoId)
                .query((rs, i) -> new Lote(rs.getLong(1), rs.getObject(2, Long.class), rs.getString(3), rs.getInt(4)))
                .list();
    }

    @Override
    public void ajustarLote(long produtoId, Long remessaId, int delta) {
        int alterados = jdbc.sql("""
                update lote_estoque set quantidade = quantidade + :delta
                where produto_id = :produto and remessa_id is not distinct from cast(:remessa as bigint)""")
                .param("delta", delta)
                .param("produto", produtoId)
                .param("remessa", remessaId)
                .update();
        if (alterados == 0) {
            jdbc.sql("insert into lote_estoque (produto_id, remessa_id, quantidade) values (:produto, :remessa, :delta)")
                    .param("produto", produtoId)
                    .param("remessa", remessaId)
                    .param("delta", delta)
                    .update();
        }
    }

    @Override
    public void registrar(MovimentoEstoque m) {
        jdbc.sql("""
                insert into movimento_estoque (produto_id, remessa_id, tipo, quantidade, ocorrido_em, usuario_subject,
                    usuario_nome, referencia_tipo, referencia_id, estorna_movimento_id)
                values (:produto, :remessa, :tipo, :quantidade, :em, :usuario, :nome, :refTipo, :refId, :estorna)""")
                .param("produto", m.produtoId())
                .param("remessa", m.remessaId())
                .param("tipo", m.tipo().name())
                .param("quantidade", m.quantidade())
                .param("em", Timestamp.from(m.ocorridoEm()))
                .param("usuario", m.usuarioSubject())
                .param("nome", m.usuarioNome())
                .param("refTipo", m.referenciaTipo())
                .param("refId", m.referenciaId())
                .param("estorna", m.estornaMovimentoId())
                .update();
    }

    @Override
    public List<MovimentoEstoque> movimentos(long produtoId) {
        return jdbc.sql("select * from movimento_estoque where produto_id = ? order by ocorrido_em, id")
                .param(produtoId)
                .query(EstoqueJdbcAdapter::movimento)
                .list();
    }

    @Override
    public List<MovimentoEstoque> movimentosDaReferencia(String referenciaTipo, long referenciaId) {
        return jdbc.sql("select * from movimento_estoque where referencia_tipo = ? and referencia_id = ? order by id")
                .params(referenciaTipo, referenciaId)
                .query(EstoqueJdbcAdapter::movimento)
                .list();
    }

    @Override
    public List<MovimentoEstoque> movimentosDaRemessa(long remessaId) {
        return jdbc.sql("select * from movimento_estoque where remessa_id = ? order by ocorrido_em, id")
                .param(remessaId)
                .query(EstoqueJdbcAdapter::movimento)
                .list();
    }

    @Override
    public boolean possuiHistorico(long produtoId) {
        return jdbc.sql("""
                select exists (select 1 from movimento_estoque where produto_id = :p)
                    or exists (select 1 from remessa_item where produto_id = :p)
                    or exists (select 1 from venda_item where produto_id = :p)
                    or exists (select 1 from solicitacao_estoque where produto_id = :p)
                    or exists (select 1 from lote_estoque where produto_id = :p and quantidade > 0)""")
                .param("p", produtoId)
                .query(Boolean.class)
                .single();
    }

    static MovimentoEstoque movimento(ResultSet rs, int linha) throws SQLException {
        return new MovimentoEstoque(rs.getLong("id"), rs.getLong("produto_id"), rs.getObject("remessa_id", Long.class),
                TipoMovimento.valueOf(rs.getString("tipo")), rs.getInt("quantidade"),
                rs.getTimestamp("ocorrido_em").toInstant(), rs.getString("usuario_subject"),
                rs.getString("usuario_nome"), rs.getString("referencia_tipo"),
                rs.getObject("referencia_id", Long.class), rs.getObject("estorna_movimento_id", Long.class));
    }
}
