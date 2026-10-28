package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.ValorMensalidade;
import com.durvalcrm.administracao.domain.ValorMensalidadeRepository;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ValorMensalidadeJdbcAdapter implements ValorMensalidadeRepository {

    private final JdbcClient jdbc;

    ValorMensalidadeJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ValorMensalidade> listar() {
        return jdbc.sql("select * from valor_mensalidade order by vigente_de").query(ValorMensalidadeJdbcAdapter::mapear)
                .list();
    }

    @Override
    public void travar() {
        jdbc.sql("lock table valor_mensalidade in share row exclusive mode").update();
    }

    @Override
    public ValorMensalidade inserir(ValorMensalidade v) {
        long id = jdbc.sql("""
                insert into valor_mensalidade (valor, vigente_de, motivo, criado_por, criado_por_nome, criado_em)
                values (?, ?, ?, ?, ?, ?) returning id""")
                .params(v.valor(), Date.valueOf(v.vigenteDe().atDay(1)), v.motivo(), v.autor().subject(),
                        v.autor().nome(), Timestamp.from(v.autor().em()))
                .query(Long.class).single();
        return new ValorMensalidade(id, v.valor(), v.vigenteDe(), v.motivo(), v.autor());
    }

    @Override
    public void atualizar(ValorMensalidade v) {
        jdbc.sql("""
                update valor_mensalidade set valor = ?, vigente_de = ?, motivo = ?, criado_por = ?, criado_por_nome = ?,
                    criado_em = ? where id = ?""")
                .params(v.valor(), Date.valueOf(v.vigenteDe().atDay(1)), v.motivo(), v.autor().subject(),
                        v.autor().nome(), Timestamp.from(v.autor().em()), v.id())
                .update();
    }

    @Override
    public void excluir(long id) {
        jdbc.sql("delete from valor_mensalidade where id = ?").param(id).update();
    }

    private static ValorMensalidade mapear(ResultSet rs, int i) throws SQLException {
        return new ValorMensalidade(rs.getLong("id"), rs.getBigDecimal("valor"),
                YearMonth.from(rs.getDate("vigente_de").toLocalDate()), rs.getString("motivo"),
                new Autor(rs.getString("criado_por"), rs.getString("criado_por_nome"),
                        rs.getTimestamp("criado_em").toInstant()));
    }
}
