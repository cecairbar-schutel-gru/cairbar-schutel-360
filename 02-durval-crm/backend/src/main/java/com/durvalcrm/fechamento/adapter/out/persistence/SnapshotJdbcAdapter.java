package com.durvalcrm.fechamento.adapter.out.persistence;

import com.durvalcrm.fechamento.application.Demonstrativo;
import com.durvalcrm.fechamento.application.SnapshotsPort;
import com.durvalcrm.fechamento.domain.Autor;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Versões em JSONB: o demonstrativo inteiro e, à parte, o saldo de cada conta no fim do mês. */
@Component
class SnapshotJdbcAdapter implements SnapshotsPort {

    private final JdbcClient jdbc;
    private final JsonMapper json;

    SnapshotJdbcAdapter(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public int gravar(YearMonth mes, Demonstrativo demonstrativo, Autor autor) {
        int versao = jdbc.sql("select coalesce(max(versao), 0) + 1 from periodo_snapshot where mes = ?")
                .param(PeriodoJdbcAdapter.dia(mes)).query(Integer.class).single();
        List<Map<String, Object>> saldos = demonstrativo.contas().stream()
                .map(c -> Map.<String, Object>of("contaId", c.contaId(), "nome", c.nome(), "saldo", c.saldoFinal()))
                .toList();
        jdbc.sql("""
                insert into periodo_snapshot (mes, versao, saldos_contas, demonstrativo, criado_em, criado_por,
                    criado_por_nome) values (?, ?, ?::jsonb, ?::jsonb, ?, ?, ?)""")
                .params(PeriodoJdbcAdapter.dia(mes), versao, json.writeValueAsString(saldos),
                        json.writeValueAsString(demonstrativo), Timestamp.from(autor.em()), autor.subject(), autor.nome())
                .update();
        return versao;
    }

    @Override
    public Optional<Snapshot> ultima(YearMonth mes) {
        return jdbc.sql("select * from periodo_snapshot where mes = ? order by versao desc limit 1")
                .param(PeriodoJdbcAdapter.dia(mes))
                .query((rs, i) -> snapshot(mes, rs.getInt("versao"), rs.getString("demonstrativo"), autor(rs)))
                .optional();
    }

    @Override
    public Optional<Snapshot> versao(YearMonth mes, int versao) {
        return jdbc.sql("select * from periodo_snapshot where mes = ? and versao = ?")
                .params(PeriodoJdbcAdapter.dia(mes), versao)
                .query((rs, i) -> snapshot(mes, rs.getInt("versao"), rs.getString("demonstrativo"), autor(rs)))
                .optional();
    }

    @Override
    public List<VersaoSnapshot> versoes(YearMonth mes) {
        return jdbc.sql("select versao, criado_por, criado_por_nome, criado_em from periodo_snapshot where mes = ? "
                + "order by versao desc")
                .param(PeriodoJdbcAdapter.dia(mes))
                .query((rs, i) -> new VersaoSnapshot(rs.getInt("versao"), autor(rs)))
                .list();
    }

    private Snapshot snapshot(YearMonth mes, int versao, String conteudo, Autor autor) {
        return new Snapshot(mes, versao, json.readValue(conteudo, Demonstrativo.class), autor);
    }

    private static Autor autor(ResultSet rs) throws SQLException {
        return new Autor(rs.getString("criado_por"), rs.getString("criado_por_nome"),
                rs.getTimestamp("criado_em").toInstant());
    }
}
