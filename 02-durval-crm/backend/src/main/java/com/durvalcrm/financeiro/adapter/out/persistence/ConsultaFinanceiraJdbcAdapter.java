package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort;
import com.durvalcrm.financeiro.application.FiltroLancamentos;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ConsultaFinanceiraJdbcAdapter implements ConsultaFinanceiraPort {

    private final JdbcClient jdbc;

    ConsultaFinanceiraJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * O saldo inicial é o da data de corte; o histórico importado (antes do corte, US-ADMIN-012) já está
     * nele. Numa data depois do corte somam-se as linhas do corte até ela; numa data anterior, tiram-se
     * as linhas importadas entre ela e o corte.
     */
    private static final String SALDO_ATE = """
            c.saldo_inicial + coalesce((
                select sum(case when l.data_financeira >= c.data_corte then
                                     case when l.data_financeira <= :data then lc.valor else 0 end
                                else case when l.data_financeira > :data then -lc.valor else 0 end end)
                from lancamento_linha_conta lc
                join lancamento_financeiro l on l.id = lc.lancamento_id
                where lc.conta_id = c.id), 0)""";

    @Override
    public Map<Long, BigDecimal> saldos(LocalDate data) {
        // Sem data: o saldo atual (todas as linhas a partir do corte).
        LocalDate ate = data == null ? LocalDate.of(9999, 12, 31) : data;
        Map<Long, BigDecimal> saldos = new HashMap<>();
        jdbc.sql("select c.id, " + SALDO_ATE + " as saldo from conta_financeira c")
                .param("data", Date.valueOf(ate))
                .query(rs -> {
                    saldos.put(rs.getLong("id"), rs.getBigDecimal("saldo"));
                });
        return saldos;
    }

    @Override
    public Map<TipoCartao, BigDecimal> somaPorTipoCartao(long contaId) {
        Map<TipoCartao, BigDecimal> somas = new EnumMap<>(TipoCartao.class);
        jdbc.sql("""
                select lc.tipo_cartao, sum(lc.valor) as soma from lancamento_linha_conta lc
                join lancamento_financeiro l on l.id = lc.lancamento_id
                join conta_financeira c on c.id = lc.conta_id
                where lc.conta_id = :conta and lc.tipo_cartao is not null and l.data_financeira >= c.data_corte
                group by lc.tipo_cartao""")
                .param("conta", contaId)
                .query(rs -> {
                    somas.put(TipoCartao.valueOf(rs.getString("tipo_cartao")), rs.getBigDecimal("soma"));
                });
        return somas;
    }

    @Override
    public BigDecimal saldoAntesDe(long contaId, LocalDate data) {
        return jdbc.sql("select " + SALDO_ATE + " from conta_financeira c where c.id = :conta")
                .param("data", Date.valueOf(data.minusDays(1)))
                .param("conta", contaId)
                .query(BigDecimal.class)
                .single();
    }

    @Override
    public BigDecimal somaNoPeriodo(long contaId, LocalDate de, LocalDate ate) {
        List<Object> params = new ArrayList<>(List.of(contaId, Date.valueOf(de)));
        String limite = "";
        if (ate != null) {
            limite = " and l.data_financeira <= ?";
            params.add(Date.valueOf(ate));
        }
        return jdbc.sql("""
                select coalesce(sum(lc.valor), 0) from lancamento_linha_conta lc
                join lancamento_financeiro l on l.id = lc.lancamento_id
                where lc.conta_id = ? and l.data_financeira >= ?""" + limite)
                .params(params)
                .query(BigDecimal.class)
                .single();
    }

    @Override
    public List<LinhaPagina> pagina(FiltroLancamentos f, int deslocamento, int limite) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql;
        if (f.contaId() == null) {
            sql = new StringBuilder("""
                    select l.id, null::numeric as saldo_apos, null::boolean as conciliado
                    from lancamento_financeiro l where true""");
            periodo(f.de(), f.ate(), sql, params);
        } else {
            // Saldo corrido sobre todas as linhas da conta no período; os demais filtros só escondem linhas.
            // Sem data inicial, desde a data de corte; com ela, também o histórico importado antes do corte.
            LocalDate corte = jdbc.sql("select data_corte from conta_financeira where id = ?").param(f.contaId())
                    .query(LocalDate.class).single();
            LocalDate de = f.de() == null ? corte : f.de();
            BigDecimal abertura = saldoAntesDe(f.contaId(), de);
            sql = new StringBuilder("""
                    with movimentos as (
                        select l.id, m.conciliado,
                               sum(m.valor) over (order by l.data_financeira, l.id
                                                  rows between unbounded preceding and current row) as acumulado
                        from lancamento_financeiro l
                        join (select lancamento_id, sum(valor) as valor, bool_or(conciliacao_id is not null) as conciliado
                              from lancamento_linha_conta where conta_id = ? group by lancamento_id) m
                          on m.lancamento_id = l.id
                        where true""");
            params.add(f.contaId());
            periodo(de, f.ate(), sql, params);
            sql.append("\n" + """
                    )
                    select l.id, ? + mv.acumulado as saldo_apos, mv.conciliado
                    from movimentos mv join lancamento_financeiro l on l.id = mv.id where true""");
            params.add(abertura);
        }
        if (f.natureza() != null) {
            sql.append(" and l.natureza = ?");
            params.add(f.natureza().name());
        }
        if (f.origem() != null && !f.origem().isBlank()) {
            sql.append(" and l.origem_tipo = ?");
            params.add(f.origem());
        }
        if (f.categoria() != null && !f.categoria().isBlank()) {
            sql.append(" " + """
                     and exists (select 1 from lancamento_linha_categoria c where c.lancamento_id = l.id
                                 and (c.categoria_codigo = ? or c.categoria_codigo like ?))""");
            params.add(f.categoria());
            params.add(f.categoria() + ".%");
        }
        if (f.texto() != null && !f.texto().isBlank()) {
            sql.append(" and l.descricao ilike ? escape '\\'");
            params.add("%" + f.texto().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
        }
        if (f.valor() != null) {
            sql.append(" " + """
                     and (exists (select 1 from lancamento_linha_conta x where x.lancamento_id = l.id and abs(x.valor) = ?)
                          or exists (select 1 from lancamento_linha_categoria y where y.lancamento_id = l.id
                                     and abs(y.valor) = ?))""");
            params.add(f.valor().abs());
            params.add(f.valor().abs());
        }
        sql.append(" order by l.data_financeira, l.id limit ? offset ?");
        params.add(limite);
        params.add(deslocamento);
        return jdbc.sql(sql.toString()).params(params)
                .query((rs, i) -> new LinhaPagina(rs.getLong("id"), rs.getBigDecimal("saldo_apos"),
                        (Boolean) rs.getObject("conciliado")))
                .list();
    }

    @Override
    public Map<Long, Long> estornos(Collection<Long> lancamentos) {
        Map<Long, Long> estornos = new HashMap<>();
        if (lancamentos.isEmpty()) {
            return estornos;
        }
        jdbc.sql("select estorna_lancamento_id, id from lancamento_financeiro where estorna_lancamento_id in (:ids)")
                .param("ids", lancamentos)
                .query(rs -> {
                    estornos.put(rs.getLong(1), rs.getLong(2));
                });
        return estornos;
    }

    @Override
    public List<Long> correcoes(long lancamentoId) {
        return jdbc.sql("select id from lancamento_financeiro where corrige_lancamento_id = ? order by id")
                .param(lancamentoId).query(Long.class).list();
    }

    @Override
    public Map<Long, Long> naoConciliadosPorBanco() {
        Map<Long, Long> pendentes = new HashMap<>();
        jdbc.sql("""
                select lc.conta_id, count(distinct lc.lancamento_id) from lancamento_linha_conta lc
                join conta_financeira c on c.id = lc.conta_id
                where c.tipo = 'BANCO' and lc.conciliacao_id is null group by lc.conta_id""")
                .query(rs -> {
                    pendentes.put(rs.getLong(1), rs.getLong(2));
                });
        return pendentes;
    }

    @Override
    public List<Cancelamento> cancelamentosDesde(Instant desde) {
        return jdbc.sql("""
                select e.id, e.data_financeira, e.criado_em, e.origem_tipo, e.origem_id, o.descricao,
                       coalesce(e.criado_por_nome, e.criado_por) as autor,
                       (select sum(c.valor) from lancamento_linha_categoria c where c.lancamento_id = o.id) as valor
                from lancamento_financeiro e join lancamento_financeiro o on o.id = e.estorna_lancamento_id
                where e.origem_tipo in (?, ?) and e.criado_em >= ?
                order by e.criado_em desc limit 50""")
                .params(OrigemLancamento.CONTRIBUICAO, OrigemLancamento.VENDA, Timestamp.from(desde))
                .query((rs, i) -> new Cancelamento(rs.getLong("id"), rs.getDate("data_financeira").toLocalDate(),
                        rs.getTimestamp("criado_em").toInstant(), rs.getString("origem_tipo"),
                        (Long) rs.getObject("origem_id", Long.class), rs.getString("descricao"),
                        rs.getBigDecimal("valor"), rs.getString("autor")))
                .list();
    }

    @Override
    public ResumoPeriodo resumo(LocalDate de, LocalDate ate) {
        return jdbc.sql("""
                select coalesce(sum(case when cat.tipo = 'RECEITA' then x.valor end), 0) as receitas,
                       coalesce(-sum(case when cat.tipo = 'DESPESA' then x.valor end), 0) as despesas,
                       coalesce(-sum(case when x.categoria_codigo = ? then x.valor end), 0) as taxas
                from lancamento_linha_categoria x
                join lancamento_financeiro l on l.id = x.lancamento_id
                join categoria_financeira cat on cat.codigo = x.categoria_codigo
                where l.data_financeira between ? and ?""")
                .params(CategoriaFinanceira.TAXAS_CARTAO, Date.valueOf(de), Date.valueOf(ate))
                .query((rs, i) -> new ResumoPeriodo(rs.getBigDecimal("receitas"), rs.getBigDecimal("despesas"),
                        rs.getBigDecimal("taxas")))
                .single();
    }

    @Override
    public BigDecimal despesasDaCategoria(String categoria, LocalDate de, LocalDate ate) {
        return jdbc.sql("""
                select coalesce(-sum(x.valor), 0)
                from lancamento_linha_categoria x
                join lancamento_financeiro l on l.id = x.lancamento_id
                where x.categoria_codigo = ? and l.data_financeira between ? and ?""")
                .params(categoria, Date.valueOf(de), Date.valueOf(ate))
                .query(BigDecimal.class)
                .single();
    }

    @Override
    public Map<String, BigDecimal> somaPorCategoria(LocalDate de, LocalDate ate) {
        Map<String, BigDecimal> somas = new LinkedHashMap<>();
        jdbc.sql("""
                select x.categoria_codigo, sum(x.valor) from lancamento_linha_categoria x
                join lancamento_financeiro l on l.id = x.lancamento_id
                where l.data_financeira between ? and ? group by x.categoria_codigo order by x.categoria_codigo""")
                .params(Date.valueOf(de), Date.valueOf(ate))
                .query(rs -> {
                    somas.put(rs.getString(1), rs.getBigDecimal(2));
                });
        return somas;
    }

    @Override
    public List<MovimentoConta> movimentoPorConta(LocalDate de, LocalDate ate) {
        // O estorno herda a natureza do original: estorno de transferência continua sendo transferência.
        return jdbc.sql("""
                select lc.conta_id,
                       coalesce(sum(case when not t.interna and lc.valor > 0 then lc.valor end), 0) as entradas,
                       coalesce(-sum(case when not t.interna and lc.valor < 0 then lc.valor end), 0) as saidas,
                       coalesce(sum(case when t.interna and lc.valor > 0 then lc.valor end), 0) as transf_entrada,
                       coalesce(-sum(case when t.interna and lc.valor < 0 then lc.valor end), 0) as transf_saida
                from lancamento_linha_conta lc
                join (select l.id, coalesce(o.natureza, l.natureza) in ('TRANSFERENCIA', 'LIQUIDACAO') as interna
                      from lancamento_financeiro l
                      left join lancamento_financeiro o on o.id = l.estorna_lancamento_id
                      where l.data_financeira between ? and ?) t on t.id = lc.lancamento_id
                group by lc.conta_id""")
                .params(Date.valueOf(de), Date.valueOf(ate))
                .query((rs, i) -> new MovimentoConta(rs.getLong("conta_id"), rs.getBigDecimal("entradas"),
                        rs.getBigDecimal("saidas"), rs.getBigDecimal("transf_entrada"), rs.getBigDecimal("transf_saida")))
                .list();
    }

    @Override
    public List<LinhasDoLancamento> linhasNoPeriodo(LocalDate de, LocalDate ate) {
        Map<Long, LinhasDoLancamento> porId = new LinkedHashMap<>();
        jdbc.sql("select id, data_financeira from lancamento_financeiro where data_financeira between ? and ? order by data_financeira, id")
                .params(Date.valueOf(de), Date.valueOf(ate))
                .query(rs -> {
                    long id = rs.getLong(1);
                    porId.put(id, new LinhasDoLancamento(id, rs.getDate(2).toLocalDate(), new HashMap<>(), new HashMap<>()));
                });
        jdbc.sql("""
                select lc.lancamento_id, lc.conta_id, sum(lc.valor) from lancamento_linha_conta lc
                join lancamento_financeiro l on l.id = lc.lancamento_id
                where l.data_financeira between ? and ? group by lc.lancamento_id, lc.conta_id""")
                .params(Date.valueOf(de), Date.valueOf(ate))
                .query(rs -> {
                    porId.get(rs.getLong(1)).contas().merge(rs.getLong(2), rs.getBigDecimal(3), BigDecimal::add);
                });
        jdbc.sql("""
                select x.lancamento_id, x.categoria_codigo, sum(x.valor) from lancamento_linha_categoria x
                join lancamento_financeiro l on l.id = x.lancamento_id
                where l.data_financeira between ? and ? group by x.lancamento_id, x.categoria_codigo""")
                .params(Date.valueOf(de), Date.valueOf(ate))
                .query(rs -> {
                    porId.get(rs.getLong(1)).categorias().merge(rs.getString(2), rs.getBigDecimal(3), BigDecimal::add);
                });
        return new ArrayList<>(porId.values());
    }

    @Override
    public Optional<LocalDate> ultimaLiquidacaoCartao(LocalDate ate) {
        return jdbc.sql("""
                select data_financeira from lancamento_financeiro
                where natureza = 'LIQUIDACAO' and data_financeira <= ? order by data_financeira desc limit 1""")
                .param(Date.valueOf(ate))
                .query(LocalDate.class)
                .optional();
    }

    private static void periodo(LocalDate de, LocalDate ate, StringBuilder sql, List<Object> params) {
        if (de != null) {
            sql.append(" and l.data_financeira >= ?");
            params.add(Date.valueOf(de));
        }
        if (ate != null) {
            sql.append(" and l.data_financeira <= ?");
            params.add(Date.valueOf(ate));
        }
    }
}
