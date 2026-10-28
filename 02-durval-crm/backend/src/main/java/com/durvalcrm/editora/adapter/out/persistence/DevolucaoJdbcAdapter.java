package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.Devolucao;
import com.durvalcrm.editora.domain.DevolucaoRepository;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class DevolucaoJdbcAdapter implements DevolucaoRepository {

    private final JdbcClient jdbc;

    DevolucaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Devolucao salvar(Devolucao d) {
        long id = jdbc.sql("""
                insert into devolucao_editora (remessa_id, devolvida_em, observacao, registrada_em,
                    registrada_por_subject, registrada_por)
                values (?, ?, ?, ?, ?, ?) returning id""")
                .params(d.remessaId(), Date.valueOf(d.devolvidaEm()), d.observacao(), Timestamp.from(d.registradaEm()),
                        d.registradaPorSubject(), d.registradaPor())
                .query(Long.class)
                .single();
        for (Devolucao.Item i : d.itens()) {
            jdbc.sql("insert into devolucao_editora_item (devolucao_id, produto_id, quantidade) values (?, ?, ?)")
                    .params(id, i.produtoId(), i.quantidade())
                    .update();
        }
        return new Devolucao(id, d.remessaId(), d.devolvidaEm(), d.observacao(), d.itens(), d.registradaEm(),
                d.registradaPorSubject(), d.registradaPor());
    }

    @Override
    public Optional<Devolucao> obter(long id) {
        return jdbc.sql("select * from devolucao_editora where id = ?").param(id).query(this::mapear).optional();
    }

    @Override
    public List<Devolucao> daRemessa(long remessaId) {
        return jdbc.sql("select * from devolucao_editora where remessa_id = ? order by devolvida_em, id")
                .param(remessaId)
                .query(this::mapear)
                .list();
    }

    private Devolucao mapear(ResultSet rs, int linha) throws SQLException {
        long id = rs.getLong("id");
        List<Devolucao.Item> itens = jdbc.sql("""
                select produto_id, quantidade from devolucao_editora_item where devolucao_id = ? order by produto_id""")
                .param(id)
                .query((r, n) -> new Devolucao.Item(r.getLong(1), r.getInt(2)))
                .list();
        return new Devolucao(id, rs.getLong("remessa_id"), rs.getDate("devolvida_em").toLocalDate(),
                rs.getString("observacao"), itens, rs.getTimestamp("registrada_em").toInstant(),
                rs.getString("registrada_por_subject"), rs.getString("registrada_por"));
    }
}
