package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.PedidoLivrosRepository;
import com.durvalcrm.editora.domain.StatusPedidoLivros;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class PedidoLivrosJdbcAdapter implements PedidoLivrosRepository {

    private final JdbcClient jdbc;

    PedidoLivrosJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<PedidoLivros> obter(long id) {
        return jdbc.sql("select * from pedido_livros where id = ?").param(id).query(this::mapear).optional();
    }

    @Override
    public Optional<PedidoLivros> travar(long id) {
        return jdbc.sql("select * from pedido_livros where id = ? for update").param(id).query(this::mapear).optional();
    }

    @Override
    public Optional<PedidoLivros> travarDaRemessa(long remessaId) {
        return jdbc.sql("select * from pedido_livros where remessa_id = ? for update").param(remessaId)
                .query(this::mapear).optional();
    }

    @Override
    public List<PedidoLivros> listar(Long editoraId, StatusPedidoLivros status) {
        return jdbc.sql("""
                select * from pedido_livros
                where (cast(:editora as bigint) is null or editora_id = :editora)
                  and (cast(:status as varchar) is null or status = :status)
                order by pedido_em desc, id desc""")
                .param("editora", editoraId)
                .param("status", status == null ? null : status.name())
                .query(this::mapear)
                .list();
    }

    @Override
    public PedidoLivros salvar(PedidoLivros p) {
        if (p.getId() != null) {
            jdbc.sql("""
                    update pedido_livros set status = :status, remessa_id = :remessa, cancelado_em = :em,
                        cancelado_por = :por, motivo_cancelamento = :motivo where id = :id""")
                    .param("status", p.getStatus().name())
                    .param("remessa", p.getRemessaId())
                    .param("em", p.getCanceladoEm() == null ? null : Timestamp.from(p.getCanceladoEm()))
                    .param("por", p.getCanceladoPor())
                    .param("motivo", p.getMotivoCancelamento())
                    .param("id", p.getId())
                    .update();
            return p;
        }
        long id = jdbc.sql("""
                insert into pedido_livros (editora_id, status, observacao, pedido_em, pedido_por)
                values (:editora, :status, :observacao, :em, :por)
                returning id""")
                .param("editora", p.getEditoraId())
                .param("status", p.getStatus().name())
                .param("observacao", p.getObservacao())
                .param("em", Timestamp.from(p.getPedidoEm()))
                .param("por", p.getPedidoPor())
                .query(Long.class)
                .single();
        for (PedidoLivros.Item i : p.getItens()) {
            jdbc.sql("insert into pedido_livros_item (pedido_id, produto_id, quantidade) values (?, ?, ?)")
                    .params(id, i.produtoId(), i.quantidade())
                    .update();
        }
        return PedidoLivros.reconstituir(id, p.getEditoraId(), p.getStatus(), p.getItens(), p.getObservacao(),
                p.getPedidoEm(), p.getPedidoPor(), null, null, null, null);
    }

    private PedidoLivros mapear(ResultSet rs, int linha) throws SQLException {
        long id = rs.getLong("id");
        List<PedidoLivros.Item> itens = jdbc.sql("""
                select produto_id, quantidade from pedido_livros_item where pedido_id = ? order by produto_id""")
                .param(id)
                .query((r, n) -> new PedidoLivros.Item(r.getLong(1), r.getInt(2)))
                .list();
        Long remessa = rs.getObject("remessa_id", Long.class);
        return PedidoLivros.reconstituir(id, rs.getLong("editora_id"), StatusPedidoLivros.valueOf(rs.getString("status")),
                itens, rs.getString("observacao"), RemessaJdbcAdapter.instante(rs, "pedido_em"),
                rs.getString("pedido_por"), remessa, RemessaJdbcAdapter.instante(rs, "cancelado_em"),
                rs.getString("cancelado_por"), rs.getString("motivo_cancelamento"));
    }
}
