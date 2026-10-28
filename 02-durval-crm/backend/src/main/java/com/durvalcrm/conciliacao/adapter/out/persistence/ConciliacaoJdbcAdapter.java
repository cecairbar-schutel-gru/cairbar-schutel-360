package com.durvalcrm.conciliacao.adapter.out.persistence;

import com.durvalcrm.conciliacao.domain.Conciliacao;
import com.durvalcrm.conciliacao.domain.ConciliacaoRepository;
import com.durvalcrm.conciliacao.domain.StatusConciliacao;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ConciliacaoJdbcAdapter implements ConciliacaoRepository {

    private final JdbcClient jdbc;

    ConciliacaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Conciliacao salvar(Conciliacao c) {
        if (c.getId() == null) {
            try {
                long id = jdbc.sql("""
                        insert into conciliacao (conta_id, data_fim, saldo_extrato, saldo_abertura, status, iniciada_por,
                            iniciada_por_nome, iniciada_em) values (?, ?, ?, ?, ?, ?, ?, ?) returning id""")
                        .params(c.getContaId(), Date.valueOf(c.getDataFim()), c.getSaldoExtrato(), c.getSaldoAbertura(),
                                c.getStatus().name(), c.getIniciadaPor(), c.getIniciadaPorNome(),
                                Timestamp.from(c.getIniciadaEm()))
                        .query(Long.class)
                        .single();
                return buscarPorId(id).orElseThrow();
            } catch (DuplicateKeyException e) {
                // Duas sessões iniciadas ao mesmo tempo: o índice único deixa só uma em andamento.
                throw new RegraDeNegocioException("CONCILIACAO_EM_ANDAMENTO",
                        "Já existe uma conciliação em andamento para esta conta: continue-a.");
            }
        }
        jdbc.sql("""
                update conciliacao set data_fim = ?, saldo_extrato = ?, status = ?, concluida_por = ?,
                    concluida_por_nome = ?, concluida_em = ? where id = ?""")
                .params(Date.valueOf(c.getDataFim()), c.getSaldoExtrato(), c.getStatus().name(), c.getConcluidaPor(),
                        c.getConcluidaPorNome(), c.getConcluidaEm() == null ? null : Timestamp.from(c.getConcluidaEm()),
                        c.getId())
                .update();
        return c;
    }

    @Override
    public Optional<Conciliacao> buscarPorId(long id) {
        return jdbc.sql("select * from conciliacao where id = ?").param(id).query(ConciliacaoJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public Optional<Conciliacao> travar(long id) {
        return jdbc.sql("select * from conciliacao where id = ? for update").param(id)
                .query(ConciliacaoJdbcAdapter::mapear).optional();
    }

    @Override
    public Optional<Conciliacao> emAndamento(long contaId) {
        return jdbc.sql("select * from conciliacao where conta_id = ? and status = 'EM_ANDAMENTO'").param(contaId)
                .query(ConciliacaoJdbcAdapter::mapear).optional();
    }

    @Override
    public Optional<Conciliacao> ultimaConcluida(long contaId) {
        return jdbc.sql("""
                select * from conciliacao where conta_id = ? and status = 'CONCLUIDA'
                order by data_fim desc, id desc limit 1""")
                .param(contaId).query(ConciliacaoJdbcAdapter::mapear).optional();
    }

    private static Conciliacao mapear(ResultSet rs, int linha) throws SQLException {
        Timestamp concluidaEm = rs.getTimestamp("concluida_em");
        return Conciliacao.reconstituir(rs.getLong("id"), rs.getLong("conta_id"), rs.getDate("data_fim").toLocalDate(),
                rs.getBigDecimal("saldo_extrato"), rs.getBigDecimal("saldo_abertura"),
                StatusConciliacao.valueOf(rs.getString("status")), rs.getString("iniciada_por"),
                rs.getString("iniciada_por_nome"), rs.getTimestamp("iniciada_em").toInstant(),
                rs.getString("concluida_por"), rs.getString("concluida_por_nome"),
                concluidaEm == null ? null : concluidaEm.toInstant());
    }
}
