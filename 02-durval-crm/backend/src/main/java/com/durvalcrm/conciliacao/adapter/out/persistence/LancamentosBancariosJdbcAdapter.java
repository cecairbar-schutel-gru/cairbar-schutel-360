package com.durvalcrm.conciliacao.adapter.out.persistence;

import com.durvalcrm.conciliacao.application.LancamentosBancariosPort;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Lê as linhas bancárias do Financeiro (tabelas {@code lancamento_*}) e grava as marcações da
 * sessão. A única escrita em tabela do Financeiro é {@code lancamento_linha_conta.conciliacao_id},
 * coluna reservada para este módulo desde a migração V5.
 */
@Component
class LancamentosBancariosJdbcAdapter implements LancamentosBancariosPort {

    /** Movimento líquido de cada lançamento ainda não conciliado na conta. */
    private static final String MOVIMENTOS_ABERTOS = """
            select lancamento_id, sum(valor) as valor from lancamento_linha_conta
            where conta_id = :conta and conciliacao_id is null group by lancamento_id""";

    private static final String COLUNAS = """
            l.id, l.data_financeira, l.descricao, l.origem_tipo, l.origem_id, l.natureza, l.estorna_lancamento_id,
            l.corrige_lancamento_id, (select e.id from lancamento_financeiro e where e.estorna_lancamento_id = l.id)
            as estornado_por""";

    private final JdbcClient jdbc;

    LancamentosBancariosJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<LancamentoBancario> candidatos(long conciliacaoId, long contaId, LocalDate dataCorte,
            LocalDate dataFim) {
        return jdbc.sql("select " + COLUNAS + """
                , m.valor, i.lancamento_id is not null as marcado, coalesce(i.marcado_por_nome, i.marcado_por)
                as marcado_por, i.marcado_em, coalesce(i.adicionado, false) as adicionado
                from (""" + MOVIMENTOS_ABERTOS + """
                ) m join lancamento_financeiro l on l.id = m.lancamento_id
                left join conciliacao_item i on i.conciliacao_id = :sessao and i.lancamento_id = l.id
                where l.data_financeira between :de and :ate
                order by l.data_financeira, l.id""")
                .param("conta", contaId)
                .param("sessao", conciliacaoId)
                .param("de", Date.valueOf(dataCorte))
                .param("ate", Date.valueOf(dataFim))
                .query(LancamentosBancariosJdbcAdapter::mapear)
                .list();
    }

    @Override
    public int marcar(long conciliacaoId, long contaId, Collection<Long> lancamentos, Lancamento.Autor autor,
            boolean adicionado) {
        return jdbc.sql("""
                insert into conciliacao_item (conciliacao_id, lancamento_id, conta_id, valor, marcado_por,
                    marcado_por_nome, marcado_em, adicionado)
                select :sessao, lancamento_id, :conta, sum(valor), :por, :nome, :em, :adicionado
                from lancamento_linha_conta
                where conta_id = :conta and conciliacao_id is null and lancamento_id in (:ids)
                group by lancamento_id
                on conflict do nothing""")
                .param("sessao", conciliacaoId)
                .param("conta", contaId)
                .param("por", autor.subject())
                .param("nome", autor.nome())
                .param("em", Timestamp.from(autor.em()))
                .param("adicionado", adicionado)
                .param("ids", lancamentos)
                .update();
    }

    @Override
    public int desmarcar(long conciliacaoId, Collection<Long> lancamentos) {
        return jdbc.sql("delete from conciliacao_item where conciliacao_id = :sessao and lancamento_id in (:ids)")
                .param("sessao", conciliacaoId)
                .param("ids", lancamentos)
                .update();
    }

    @Override
    public int desmarcarDepoisDe(long conciliacaoId, LocalDate data) {
        return jdbc.sql("""
                delete from conciliacao_item i using lancamento_financeiro l
                where i.conciliacao_id = ? and l.id = i.lancamento_id and l.data_financeira > ?""")
                .params(conciliacaoId, Date.valueOf(data))
                .update();
    }

    @Override
    public BigDecimal totalMarcado(long conciliacaoId) {
        return jdbc.sql("select coalesce(sum(valor), 0) from conciliacao_item where conciliacao_id = ?")
                .param(conciliacaoId).query(BigDecimal.class).single();
    }

    @Override
    public int[] efetivar(long conciliacaoId, long contaId, LocalDate dataCorte, LocalDate dataFim) {
        int pendentes = jdbc.sql("""
                insert into conciliacao_pendente (conciliacao_id, lancamento_id, valor)
                select :sessao, m.lancamento_id, m.valor from (""" + MOVIMENTOS_ABERTOS + """
                ) m join lancamento_financeiro l on l.id = m.lancamento_id
                where l.data_financeira between :de and :ate
                  and not exists (select 1 from conciliacao_item i
                                  where i.conciliacao_id = :sessao and i.lancamento_id = m.lancamento_id)""")
                .param("sessao", conciliacaoId)
                .param("conta", contaId)
                .param("de", Date.valueOf(dataCorte))
                .param("ate", Date.valueOf(dataFim))
                .update();
        jdbc.sql("""
                update lancamento_linha_conta lc set conciliacao_id = i.conciliacao_id
                from conciliacao_item i
                where i.conciliacao_id = ? and lc.lancamento_id = i.lancamento_id and lc.conta_id = i.conta_id""")
                .param(conciliacaoId)
                .update();
        int conciliados = jdbc.sql("select count(*) from conciliacao_item where conciliacao_id = ?")
                .param(conciliacaoId).query(Integer.class).single();
        return new int[] {conciliados, pendentes};
    }

    @Override
    public List<LancamentoBancario> conciliados(long conciliacaoId) {
        return jdbc.sql("select " + COLUNAS + """
                , i.valor, true as marcado, coalesce(i.marcado_por_nome, i.marcado_por) as marcado_por, i.marcado_em,
                i.adicionado
                from conciliacao_item i join lancamento_financeiro l on l.id = i.lancamento_id
                where i.conciliacao_id = ? order by l.data_financeira, l.id""")
                .param(conciliacaoId)
                .query(LancamentosBancariosJdbcAdapter::mapear)
                .list();
    }

    @Override
    public List<LancamentoBancario> pendentes(long conciliacaoId) {
        return jdbc.sql("select " + COLUNAS + """
                , p.valor, false as marcado, null as marcado_por, null::timestamptz as marcado_em, false as adicionado
                from conciliacao_pendente p join lancamento_financeiro l on l.id = p.lancamento_id
                where p.conciliacao_id = ? order by l.data_financeira, l.id""")
                .param(conciliacaoId)
                .query(LancamentosBancariosJdbcAdapter::mapear)
                .list();
    }

    @Override
    public Map<Long, Long> naoConciliadosPorConta() {
        Map<Long, Long> contagem = new HashMap<>();
        jdbc.sql("""
                select lc.conta_id, count(distinct lc.lancamento_id) from lancamento_linha_conta lc
                join conta_financeira c on c.id = lc.conta_id
                join lancamento_financeiro l on l.id = lc.lancamento_id
                where c.tipo = 'BANCO' and lc.conciliacao_id is null and l.data_financeira >= c.data_corte
                group by lc.conta_id""")
                .query(rs -> {
                    contagem.put(rs.getLong(1), rs.getLong(2));
                });
        return contagem;
    }

    @Override
    public List<ResumoConciliacao> concluidas(Long contaId) {
        String filtro = contaId == null ? "" : " and c.conta_id = :conta";
        var sql = jdbc.sql("""
                select c.id, c.conta_id, f.nome as conta_nome, c.data_fim, c.saldo_extrato,
                       coalesce(c.concluida_por_nome, c.concluida_por) as concluida_por, c.concluida_em,
                       (select count(*) from conciliacao_item i where i.conciliacao_id = c.id) as conciliados,
                       (select count(*) from conciliacao_pendente p where p.conciliacao_id = c.id) as pendentes
                from conciliacao c join conta_financeira f on f.id = c.conta_id
                where c.status = 'CONCLUIDA'""" + filtro + " order by c.data_fim desc, c.id desc limit 500");
        if (contaId != null) {
            sql = sql.param("conta", contaId);
        }
        return sql.query((rs, i) -> new ResumoConciliacao(rs.getLong("id"), rs.getLong("conta_id"),
                rs.getString("conta_nome"), rs.getDate("data_fim").toLocalDate(), rs.getBigDecimal("saldo_extrato"),
                rs.getLong("conciliados"), rs.getLong("pendentes"), rs.getString("concluida_por"),
                rs.getTimestamp("concluida_em").toInstant())).list();
    }

    private static LancamentoBancario mapear(ResultSet rs, int linha) throws SQLException {
        Timestamp marcadoEm = rs.getTimestamp("marcado_em");
        return new LancamentoBancario(rs.getLong("id"), rs.getDate("data_financeira").toLocalDate(),
                rs.getString("descricao"), rs.getString("origem_tipo"), rs.getObject("origem_id", Long.class),
                NaturezaLancamento.valueOf(rs.getString("natureza")), rs.getBigDecimal("valor"),
                rs.getObject("estorna_lancamento_id", Long.class), rs.getObject("estornado_por", Long.class),
                rs.getObject("corrige_lancamento_id", Long.class), rs.getBoolean("marcado"),
                rs.getString("marcado_por"), marcadoEm == null ? null : marcadoEm.toInstant(),
                rs.getBoolean("adicionado"));
    }
}
