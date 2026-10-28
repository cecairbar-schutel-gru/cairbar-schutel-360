package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.TransferenciaSaldo;
import com.durvalcrm.editora.domain.TransferenciaSaldoRepository;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class TransferenciaSaldoJdbcAdapter implements TransferenciaSaldoRepository {

    private final JdbcClient jdbc;

    TransferenciaSaldoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public TransferenciaSaldo salvar(TransferenciaSaldo t) {
        long id = jdbc.sql("""
                insert into transferencia_saldo_editora (editora_id, mes, valor, nota, usuario_subject, usuario_nome,
                    registrada_em)
                values (?, ?, ?, ?, ?, ?, ?) returning id""")
                .params(t.editoraId(), Date.valueOf(t.mes().atDay(1)), t.valor(), t.nota(), t.usuarioSubject(),
                        t.usuarioNome(), Timestamp.from(t.registradaEm()))
                .query(Long.class)
                .single();
        return new TransferenciaSaldo(id, t.editoraId(), t.mes(), t.valor(), t.nota(), t.usuarioSubject(),
                t.usuarioNome(), t.registradaEm());
    }

    @Override
    public Optional<TransferenciaSaldo> obter(long editoraId, YearMonth mes) {
        return jdbc.sql("select * from transferencia_saldo_editora where editora_id = ? and mes = ?")
                .params(editoraId, Date.valueOf(mes.atDay(1)))
                .query(TransferenciaSaldoJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public List<TransferenciaSaldo> doMes(YearMonth mes) {
        return jdbc.sql("select * from transferencia_saldo_editora where mes = ? order by id")
                .param(Date.valueOf(mes.atDay(1)))
                .query(TransferenciaSaldoJdbcAdapter::mapear)
                .list();
    }

    private static TransferenciaSaldo mapear(ResultSet rs, int linha) throws SQLException {
        return new TransferenciaSaldo(rs.getLong("id"), rs.getLong("editora_id"),
                YearMonth.from(rs.getDate("mes").toLocalDate()), rs.getBigDecimal("valor"), rs.getString("nota"),
                rs.getString("usuario_subject"), rs.getString("usuario_nome"),
                rs.getTimestamp("registrada_em").toInstant());
    }
}
