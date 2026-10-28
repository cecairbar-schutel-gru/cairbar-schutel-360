package com.durvalcrm.conciliacao.adapter.out.persistence;

import com.durvalcrm.conciliacao.application.ExtratoBancarioPort;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.Formato;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.LinhaNova;
import com.durvalcrm.financeiro.domain.Lancamento;
import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ExtratoBancarioJdbcAdapter implements ExtratoBancarioPort {

    private final JdbcClient jdbc;

    ExtratoBancarioJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void substituir(long conciliacaoId, String arquivo, Formato formato, List<LinhaNova> linhas,
            Lancamento.Autor autor) {
        // As linhas saem em cascata com o extrato anterior.
        jdbc.sql("delete from conciliacao_extrato where conciliacao_id = ?").param(conciliacaoId).update();
        jdbc.sql("""
                insert into conciliacao_extrato (conciliacao_id, arquivo, formato, importado_por, importado_por_nome,
                    importado_em) values (?, ?, ?, ?, ?, ?)""")
                .params(conciliacaoId, arquivo.strip(), formato.name(), autor.subject(), autor.nome(),
                        Timestamp.from(autor.em()))
                .update();
        for (int i = 0; i < linhas.size(); i++) {
            LinhaNova l = linhas.get(i);
            jdbc.sql("""
                    insert into conciliacao_extrato_linha (conciliacao_id, ordem, data, descricao, valor, identificador)
                    values (?, ?, ?, ?, ?, ?)""")
                    .params(conciliacaoId, i, Date.valueOf(l.data()), l.descricao(), l.valor(), l.identificador())
                    .update();
        }
    }

    @Override
    public Optional<ExtratoImportado> buscar(long conciliacaoId) {
        List<LinhaExtrato> linhas = jdbc.sql("""
                select id, data, descricao, valor, identificador, lancamento_id,
                       coalesce(conferida_por_nome, conferida_por) as conferida_por, conferida_em
                from conciliacao_extrato_linha where conciliacao_id = ? order by data, ordem""")
                .param(conciliacaoId)
                .query((rs, i) -> {
                    Timestamp em = rs.getTimestamp("conferida_em");
                    return new LinhaExtrato(rs.getLong("id"), rs.getDate("data").toLocalDate(), rs.getString("descricao"),
                            rs.getBigDecimal("valor"), rs.getString("identificador"),
                            rs.getObject("lancamento_id", Long.class), rs.getString("conferida_por"),
                            em == null ? null : em.toInstant());
                })
                .list();
        return jdbc.sql("""
                select arquivo, formato, coalesce(importado_por_nome, importado_por) as importado_por, importado_em
                from conciliacao_extrato where conciliacao_id = ?""")
                .param(conciliacaoId)
                .query((rs, i) -> new ExtratoImportado(rs.getString("arquivo"), Formato.valueOf(rs.getString("formato")),
                        rs.getString("importado_por"), rs.getTimestamp("importado_em").toInstant(), linhas))
                .optional();
    }

    @Override
    public void ligar(long conciliacaoId, long linhaId, long lancamentoId, Lancamento.Autor autor) {
        jdbc.sql("""
                update conciliacao_extrato_linha set lancamento_id = ?, conferida_por = ?, conferida_por_nome = ?,
                    conferida_em = ? where conciliacao_id = ? and id = ?""")
                .params(lancamentoId, autor.subject(), autor.nome(), Timestamp.from(autor.em()), conciliacaoId, linhaId)
                .update();
    }

    @Override
    public Optional<Long> desligar(long conciliacaoId, long linhaId) {
        Optional<Long> anterior = jdbc.sql("""
                select lancamento_id from conciliacao_extrato_linha
                where conciliacao_id = ? and id = ? and lancamento_id is not null""")
                .params(conciliacaoId, linhaId)
                .query(Long.class)
                .optional();
        anterior.ifPresent(x -> jdbc.sql("""
                update conciliacao_extrato_linha set lancamento_id = null, conferida_por = null,
                    conferida_por_nome = null, conferida_em = null where conciliacao_id = ? and id = ?""")
                .params(conciliacaoId, linhaId)
                .update());
        return anterior;
    }

    @Override
    public int desligarNaoMarcados(long conciliacaoId) {
        return jdbc.sql("""
                update conciliacao_extrato_linha x set lancamento_id = null, conferida_por = null,
                    conferida_por_nome = null, conferida_em = null
                where x.conciliacao_id = :sessao and x.lancamento_id is not null
                  and not exists (select 1 from conciliacao_item i
                                  where i.conciliacao_id = :sessao and i.lancamento_id = x.lancamento_id)""")
                .param("sessao", conciliacaoId)
                .update();
    }
}
