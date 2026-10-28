package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.application.ConsultaEditorasPort;
import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.StatusObrigacao;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Consultas das telas de Editoras. Lê também tabelas do Estoque e das Vendas no mesmo banco (lotes,
 * movimentos, número da venda), só para exibição. O dia de um instante é o do fuso da organização.
 */
@Component
class ConsultaEditorasJdbcAdapter implements ConsultaEditorasPort {

    /** Saldo por editora no fim do dia {@code :dia}: obrigações − estornos − pagamentos não estornados. */
    private static final String SALDOS = """
            select e.id as editora_id,
                   coalesce((select sum(o.valor) from obrigacao_editora o
                             where o.editora_id = e.id and (o.criada_em at time zone cast(:zona as text))::date <= :dia), 0)
                 - coalesce((select sum(o.valor) from obrigacao_editora o
                             where o.editora_id = e.id and o.estornada_em is not null
                               and (o.estornada_em at time zone cast(:zona as text))::date <= :dia), 0)
                 - coalesce((select sum(p.valor) from pagamento_editora p
                             where p.editora_id = e.id and p.pago_em <= :dia), 0)
                 + coalesce((select sum(p.valor) from pagamento_editora p
                             where p.editora_id = e.id and p.estornado_em is not null
                               and (p.estornado_em at time zone cast(:zona as text))::date <= :dia), 0) as saldo
            from editora e""";

    private static final String OBRIGACOES = """
            select o.id, (o.criada_em at time zone cast(:zona as text))::date as data, o.origem_tipo, o.origem_id,
                   case when o.origem_tipo = 'VENDA' then v.numero else o.origem_id end as origem_numero,
                   r.codigo, o.produto_id, p.nome, o.quantidade, o.preco_unitario, o.repasse_percentual, o.valor,
                   o.valor_pago, o.status, (o.estornada_em at time zone cast(:zona as text))::date as estornada
            from obrigacao_editora o
            join remessa r on r.id = o.remessa_id
            join produto p on p.id = o.produto_id
            left join venda v on o.origem_tipo = 'VENDA' and v.id = o.origem_id
            """;

    private static final String REMESSAS = """
            select * from (
                select r.id, r.codigo, r.editora_id, e.nome, r.recebida_em, r.numero_documento,
                       case when r.status = 'CANCELADA' then 'CANCELADA'
                            when coalesce(l.restantes, 0) = 0 then 'ENCERRADA' else 'ABERTA' end as situacao,
                       coalesce(i.recebidas, 0) as recebidas, coalesce(l.restantes, 0) as restantes
                from remessa r
                join editora e on e.id = r.editora_id
                left join (select remessa_id, sum(quantidade_recebida) as recebidas from remessa_item
                           group by remessa_id) i on i.remessa_id = r.id
                left join (select remessa_id, sum(quantidade) as restantes from lote_estoque
                           where remessa_id is not null group by remessa_id) l on l.remessa_id = r.id
            ) x
            """;

    private final JdbcClient jdbc;
    private final Clock relogio;

    ConsultaEditorasJdbcAdapter(JdbcClient jdbc, Clock relogio) {
        this.jdbc = jdbc;
        this.relogio = relogio;
    }

    private String zona() {
        return relogio.getZone().getId();
    }

    @Override
    public List<ResumoEditora> listar(Boolean ativas) {
        return jdbc.sql("with saldos as (" + SALDOS + """
                )
                select e.id, e.nome, e.cnpj, e.contato_nome, e.telefone, e.ativa, s.saldo,
                       (select count(*) from (""" + REMESSAS + """
                        ) x where x.editora_id = e.id and x.situacao = 'ABERTA') as abertas
                from editora e join saldos s on s.editora_id = e.id
                where cast(:ativas as boolean) is null or e.ativa = :ativas
                order by e.nome, e.id""")
                .param("zona", zona())
                .param("dia", Date.valueOf(LocalDate.now(relogio)))
                .param("ativas", ativas)
                .query((rs, n) -> new ResumoEditora(rs.getLong("id"), rs.getString("nome"), rs.getString("cnpj"),
                        rs.getString("contato_nome"), rs.getString("telefone"), rs.getBoolean("ativa"),
                        rs.getInt("abertas"), rs.getBigDecimal("saldo")))
                .list();
    }

    @Override
    public List<ResumoRemessa> remessas(Long editoraId, String situacao) {
        return jdbc.sql(REMESSAS + """
                where (cast(:editora as bigint) is null or editora_id = :editora)
                  and (cast(:situacao as varchar) is null or situacao = :situacao)
                order by recebida_em desc, codigo desc""")
                .param("editora", editoraId)
                .param("situacao", situacao)
                .query((rs, n) -> new ResumoRemessa(rs.getLong("id"), rs.getString("codigo"), rs.getLong("editora_id"),
                        rs.getString("nome"), rs.getDate("recebida_em").toLocalDate(), rs.getString("numero_documento"),
                        rs.getString("situacao"), rs.getInt("recebidas"), rs.getInt("restantes")))
                .list();
    }

    @Override
    public List<ItemRemessaDetalhado> itensDaRemessa(long remessaId) {
        return jdbc.sql("""
                select i.produto_id, p.nome, p.autor, p.isbn, i.quantidade_recebida, i.repasse_percentual,
                       -coalesce(sum(m.quantidade) filter (where m.tipo in ('VENDA', 'CANCELAMENTO_VENDA')), 0) as vendida,
                       -coalesce(sum(m.quantidade) filter (where m.tipo = 'DEVOLUCAO_EDITORA'), 0) as devolvida,
                       -coalesce(sum(m.quantidade) filter (where m.tipo like 'BAIXA\\_%'), 0) as baixada,
                       coalesce(sum(m.quantidade) filter (where m.tipo = 'AJUSTE'), 0) as ajustes,
                       coalesce((select l.quantidade from lote_estoque l
                                 where l.remessa_id = i.remessa_id and l.produto_id = i.produto_id), 0) as restante,
                       coalesce((select sum(o.valor) from obrigacao_editora o
                                 where o.remessa_id = i.remessa_id and o.produto_id = i.produto_id
                                   and o.status <> 'ESTORNADA'), 0) as obrigacoes
                from remessa_item i
                join produto p on p.id = i.produto_id
                left join movimento_estoque m on m.remessa_id = i.remessa_id and m.produto_id = i.produto_id
                where i.remessa_id = ?
                group by i.remessa_id, i.produto_id, p.nome, p.autor, p.isbn, i.quantidade_recebida, i.repasse_percentual
                order by p.nome""")
                .param(remessaId)
                .query((rs, n) -> new ItemRemessaDetalhado(rs.getLong("produto_id"), rs.getString("nome"),
                        rs.getString("autor"), rs.getString("isbn"), rs.getInt("quantidade_recebida"),
                        rs.getBigDecimal("repasse_percentual"), rs.getInt("vendida"), rs.getInt("devolvida"),
                        rs.getInt("baixada"), rs.getInt("ajustes"), rs.getInt("restante"),
                        rs.getBigDecimal("obrigacoes")))
                .list();
    }

    @Override
    public Optional<UltimoPagamento> ultimoPagamento(long editoraId) {
        return jdbc.sql("""
                select pago_em, valor from pagamento_editora where editora_id = ? and estornado_em is null
                order by pago_em desc, id desc limit 1""")
                .param(editoraId)
                .query((rs, n) -> new UltimoPagamento(rs.getDate(1).toLocalDate(), rs.getBigDecimal(2)))
                .optional();
    }

    @Override
    public List<SaldoEditora> saldos(LocalDate hoje) {
        return jdbc.sql("with saldos as (" + SALDOS + """
                )
                select e.id, e.nome, e.ativa, s.saldo,
                       (select min((o.criada_em at time zone cast(:zona as text))::date) from obrigacao_editora o
                        where o.editora_id = e.id and o.status in ('ABERTA', 'PARCIALMENTE_PAGA')) as mais_antiga,
                       (select max(p.pago_em) from pagamento_editora p
                        where p.editora_id = e.id and p.estornado_em is null) as ultimo_pagamento
                from editora e join saldos s on s.editora_id = e.id
                where exists (select 1 from obrigacao_editora o where o.editora_id = e.id)
                   or exists (select 1 from pagamento_editora p where p.editora_id = e.id)""")
                .param("zona", zona())
                .param("dia", Date.valueOf(hoje))
                .query((rs, n) -> new SaldoEditora(rs.getLong("id"), rs.getString("nome"), rs.getBoolean("ativa"),
                        rs.getBigDecimal("saldo"), data(rs, "mais_antiga"), data(rs, "ultimo_pagamento")))
                .list();
    }

    @Override
    public List<LinhaObrigacao> obrigacoes(long editoraId, LocalDate de, LocalDate ate) {
        return jdbc.sql(OBRIGACOES + """
                where o.editora_id = :editora
                  and (cast(:de as date) is null or (o.criada_em at time zone cast(:zona as text))::date >= :de)
                  and (cast(:ate as date) is null or (o.criada_em at time zone cast(:zona as text))::date <= :ate)
                order by o.criada_em, o.id""")
                .param("zona", zona())
                .param("editora", editoraId)
                .param("de", de == null ? null : Date.valueOf(de))
                .param("ate", ate == null ? null : Date.valueOf(ate))
                .query(ConsultaEditorasJdbcAdapter::obrigacao)
                .list();
    }

    @Override
    public List<LinhaObrigacao> obrigacoesEstornadas(long editoraId, LocalDate de, LocalDate ate) {
        return jdbc.sql(OBRIGACOES + """
                where o.editora_id = :editora and o.estornada_em is not null
                  and (o.estornada_em at time zone cast(:zona as text))::date between :de and :ate
                order by o.estornada_em, o.id""")
                .param("zona", zona())
                .param("editora", editoraId)
                .param("de", Date.valueOf(de))
                .param("ate", Date.valueOf(ate))
                .query(ConsultaEditorasJdbcAdapter::obrigacao)
                .list();
    }

    @Override
    public Map<Long, LinhaObrigacao> obrigacoesPorId(List<Long> ids) {
        Map<Long, LinhaObrigacao> mapa = new LinkedHashMap<>();
        if (ids.isEmpty()) {
            return mapa;
        }
        jdbc.sql(OBRIGACOES + " where o.id in (:ids) order by o.criada_em, o.id")
                .param("zona", zona())
                .param("ids", ids)
                .query(ConsultaEditorasJdbcAdapter::obrigacao)
                .list()
                .forEach(o -> mapa.put(o.id(), o));
        return mapa;
    }

    @Override
    public List<LinhaPagamento> pagamentos(long editoraId, LocalDate de, LocalDate ate) {
        return jdbc.sql("""
                select p.*, (p.estornado_em at time zone cast(:zona as text))::date as estornado_dia
                from pagamento_editora p
                where p.editora_id = :editora
                  and (cast(:de as date) is null
                       or p.pago_em between :de and :ate
                       or (p.estornado_em at time zone cast(:zona as text))::date between :de and :ate)
                order by p.pago_em, p.id""")
                .param("zona", zona())
                .param("editora", editoraId)
                .param("de", de == null ? null : Date.valueOf(de))
                .param("ate", ate == null ? null : Date.valueOf(ate))
                .query((rs, n) -> new LinhaPagamento(rs.getLong("id"), rs.getDate("pago_em").toLocalDate(),
                        rs.getBigDecimal("valor"), rs.getBigDecimal("credito_aplicado"), rs.getString("conta_nome"),
                        MeioPagamentoEditora.valueOf(rs.getString("meio")), rs.getString("observacao"),
                        rs.getString("registrado_por"), rs.getObject("lancamento_id", Long.class),
                        data(rs, "estornado_dia")))
                .list();
    }

    @Override
    public BigDecimal saldoEm(long editoraId, LocalDate data) {
        return jdbc.sql("select saldo from (" + SALDOS + ") s where s.editora_id = :editora")
                .param("zona", zona())
                .param("dia", Date.valueOf(data))
                .param("editora", editoraId)
                .query(BigDecimal.class)
                .optional()
                .orElse(BigDecimal.ZERO);
    }

    @Override
    public Map<Long, BigDecimal> saldosEm(LocalDate data) {
        Map<Long, BigDecimal> saldos = new HashMap<>();
        jdbc.sql("select * from (" + SALDOS + ") s where s.saldo <> 0")
                .param("zona", zona())
                .param("dia", Date.valueOf(data))
                .query(rs -> {
                    saldos.put(rs.getLong("editora_id"), rs.getBigDecimal("saldo"));
                });
        return saldos;
    }

    @Override
    public List<LinhaDevolucao> devolucoes(long editoraId, LocalDate de, LocalDate ate) {
        return jdbc.sql("""
                select d.id, d.devolvida_em, r.codigo, p.nome, i.quantidade, d.observacao
                from devolucao_editora d
                join devolucao_editora_item i on i.devolucao_id = d.id
                join remessa r on r.id = d.remessa_id
                join produto p on p.id = i.produto_id
                where r.editora_id = ? and d.devolvida_em between ? and ?
                order by d.devolvida_em, d.id, p.nome""")
                .params(editoraId, Date.valueOf(de), Date.valueOf(ate))
                .query((rs, n) -> new LinhaDevolucao(rs.getLong(1), rs.getDate(2).toLocalDate(), rs.getString(3),
                        rs.getString(4), rs.getInt(5), rs.getString(6)))
                .list();
    }

    @Override
    public List<EstoqueRemessa> estoque(long editoraId, LocalDate de, LocalDate ate) {
        return jdbc.sql("""
                select m.remessa_id, r.codigo, m.produto_id, p.nome,
                       coalesce(sum(m.quantidade) filter (where m.dia < :de), 0) as inicial,
                       coalesce(sum(m.quantidade) filter (where m.dia >= :de and m.tipo = 'ENTRADA_REMESSA'), 0) as recebida,
                       -coalesce(sum(m.quantidade) filter (where m.dia >= :de
                                                         and m.tipo in ('VENDA', 'CANCELAMENTO_VENDA')), 0) as vendida,
                       -coalesce(sum(m.quantidade) filter (where m.dia >= :de and m.tipo = 'DEVOLUCAO_EDITORA'), 0)
                           as devolvida,
                       -coalesce(sum(m.quantidade) filter (where m.dia >= :de and m.tipo like 'BAIXA\\_%'), 0) as baixada,
                       coalesce(sum(m.quantidade) filter (where m.dia >= :de and m.tipo in ('AJUSTE', 'ESTORNO')), 0)
                           as outros,
                       coalesce(sum(m.quantidade), 0) as fim
                from (select x.*, (x.ocorrido_em at time zone cast(:zona as text))::date as dia
                      from movimento_estoque x where x.remessa_id is not null) m
                join remessa r on r.id = m.remessa_id
                join produto p on p.id = m.produto_id
                where r.editora_id = :editora and m.dia <= :ate
                group by m.remessa_id, r.codigo, m.produto_id, p.nome
                having coalesce(sum(m.quantidade) filter (where m.dia < :de), 0) <> 0
                    or count(*) filter (where m.dia >= :de) > 0
                order by r.codigo, p.nome""")
                .param("zona", zona())
                .param("editora", editoraId)
                .param("de", Date.valueOf(de))
                .param("ate", Date.valueOf(ate))
                .query((rs, n) -> new EstoqueRemessa(rs.getLong("remessa_id"), rs.getString("codigo"),
                        rs.getLong("produto_id"), rs.getString("nome"), rs.getInt("inicial"), rs.getInt("recebida"),
                        rs.getInt("vendida"), rs.getInt("devolvida"), rs.getInt("baixada"), rs.getInt("outros"),
                        rs.getInt("fim")))
                .list();
    }

    private static LinhaObrigacao obrigacao(ResultSet rs, int linha) throws SQLException {
        StatusObrigacao status = StatusObrigacao.valueOf(rs.getString("status"));
        BigDecimal valor = rs.getBigDecimal("valor");
        BigDecimal pago = rs.getBigDecimal("valor_pago");
        return new LinhaObrigacao(rs.getLong("id"), rs.getDate("data").toLocalDate(),
                OrigemObrigacao.valueOf(rs.getString("origem_tipo")), rs.getLong("origem_id"),
                rs.getObject("origem_numero", Long.class), rs.getString("codigo"), rs.getLong("produto_id"),
                rs.getString("nome"), rs.getInt("quantidade"), rs.getBigDecimal("preco_unitario"),
                rs.getBigDecimal("repasse_percentual"), valor, pago,
                status == StatusObrigacao.ESTORNADA ? BigDecimal.ZERO : valor.subtract(pago), status,
                data(rs, "estornada"));
    }

    private static LocalDate data(ResultSet rs, String coluna) throws SQLException {
        Date d = rs.getDate(coluna);
        return d == null ? null : d.toLocalDate();
    }
}
