package com.durvalcrm.fechamento.adapter.out.persistence;

import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.EventoPeriodo;
import com.durvalcrm.fechamento.domain.EventoPeriodo.TipoEvento;
import com.durvalcrm.fechamento.domain.Periodo;
import com.durvalcrm.fechamento.domain.PeriodoRepository;
import com.durvalcrm.fechamento.domain.StatusPeriodo;
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
class PeriodoJdbcAdapter implements PeriodoRepository {

    private final JdbcClient jdbc;

    PeriodoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Periodo> buscar(YearMonth mes) {
        return jdbc.sql("select * from periodo where mes = ?").param(dia(mes)).query(PeriodoJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public Periodo travar(YearMonth mes) {
        jdbc.sql("insert into periodo (mes, status) values (?, 'ABERTO') on conflict (mes) do nothing")
                .param(dia(mes)).update();
        return jdbc.sql("select * from periodo where mes = ? for update").param(dia(mes))
                .query(PeriodoJdbcAdapter::mapear).single();
    }

    @Override
    public void salvar(Periodo p) {
        jdbc.sql("""
                update periodo set status = ?, fechado_por = ?, fechado_por_nome = ?, fechado_em = ?, nota = ?,
                    reaberto_por = ?, reaberto_por_nome = ?, reaberto_em = ?, justificativa_reabertura = ?,
                    cartao_confirmado_por = ?, cartao_confirmado_por_nome = ?, cartao_confirmado_em = ?
                where mes = ?""")
                .params(p.getStatus().name(), subject(p.getFechamento()), nome(p.getFechamento()), em(p.getFechamento()),
                        p.getNota(), subject(p.getReabertura()), nome(p.getReabertura()), em(p.getReabertura()),
                        p.getJustificativa(), subject(p.getCartaoConfirmado()), nome(p.getCartaoConfirmado()),
                        em(p.getCartaoConfirmado()), dia(p.getMes()))
                .update();
    }

    @Override
    public List<Periodo> listar() {
        return jdbc.sql("select * from periodo order by mes desc").query(PeriodoJdbcAdapter::mapear).list();
    }

    @Override
    public void registrar(EventoPeriodo e) {
        jdbc.sql("""
                insert into periodo_evento (mes, evento, usuario, usuario_nome, registrado_em, texto, versao)
                values (?, ?, ?, ?, ?, ?, ?)""")
                .params(dia(e.mes()), e.evento().name(), e.autor().subject(), e.autor().nome(),
                        Timestamp.from(e.autor().em()), e.texto(), e.versao())
                .update();
    }

    @Override
    public List<EventoPeriodo> eventos(YearMonth mes) {
        return jdbc.sql("select * from periodo_evento where mes = ? order by registrado_em, id").param(dia(mes))
                .query((rs, i) -> new EventoPeriodo(mes, TipoEvento.valueOf(rs.getString("evento")),
                        new Autor(rs.getString("usuario"), rs.getString("usuario_nome"),
                                rs.getTimestamp("registrado_em").toInstant()),
                        rs.getString("texto"), (Integer) rs.getObject("versao", Integer.class)))
                .list();
    }

    @Override
    public void excluir(YearMonth mes) {
        jdbc.sql("delete from periodo_snapshot where mes = ?").param(dia(mes)).update();
        jdbc.sql("delete from periodo_evento where mes = ?").param(dia(mes)).update();
        jdbc.sql("delete from periodo where mes = ?").param(dia(mes)).update();
    }

    static Date dia(YearMonth mes) {
        return Date.valueOf(mes.atDay(1));
    }

    private static Periodo mapear(ResultSet rs, int linha) throws SQLException {
        return Periodo.reconstituir(YearMonth.from(rs.getDate("mes").toLocalDate()),
                StatusPeriodo.valueOf(rs.getString("status")), autor(rs, "fechado_por", "fechado_em"), rs.getString("nota"),
                autor(rs, "reaberto_por", "reaberto_em"), rs.getString("justificativa_reabertura"),
                autor(rs, "cartao_confirmado_por", "cartao_confirmado_em"));
    }

    private static Autor autor(ResultSet rs, String coluna, String colunaEm) throws SQLException {
        String subject = rs.getString(coluna);
        Timestamp em = rs.getTimestamp(colunaEm);
        return subject == null || em == null ? null : new Autor(subject, rs.getString(coluna + "_nome"), em.toInstant());
    }

    private static String subject(Autor a) {
        return a == null ? null : a.subject();
    }

    private static String nome(Autor a) {
        return a == null ? null : a.nome();
    }

    private static Timestamp em(Autor a) {
        return a == null ? null : Timestamp.from(a.em());
    }
}
