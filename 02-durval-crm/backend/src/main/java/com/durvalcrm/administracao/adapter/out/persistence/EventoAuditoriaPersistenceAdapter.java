package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.administracao.domain.FiltroAuditoria;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Só insere e lê: a tabela também bloqueia UPDATE e DELETE por gatilho (US-ADMIN-009). */
@Component
class EventoAuditoriaPersistenceAdapter implements EventoAuditoriaRepository {

    private static final TypeReference<Map<String, Object>> MAPA = new TypeReference<>() {
    };

    private final JdbcClient jdbc;
    private final JsonMapper json;

    EventoAuditoriaPersistenceAdapter(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public void registrar(EventoAuditoria e) {
        jdbc.sql("""
                insert into evento_auditoria (registrado_em, autor_subject, autor_nome, perfil, ip, acao, entidade,
                    entidade_id, detalhes) values (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)""")
                .params(Timestamp.from(e.em()), e.autorSubject(), e.autorNome(), e.perfil(), e.ip(), e.acao(),
                        e.entidade(), e.entidadeId(), json.writeValueAsString(e.detalhes()))
                .update();
    }

    @Override
    public List<EventoAuditoria> listarPorEntidade(String entidade, String entidadeId) {
        return jdbc.sql("select * from evento_auditoria where entidade = ? and entidade_id = ? order by id")
                .params(entidade, entidadeId).query(this::mapear).list();
    }

    @Override
    public List<EventoAuditoria> pesquisar(FiltroAuditoria f, int deslocamento, int limite) {
        StringBuilder sql = new StringBuilder("select * from evento_auditoria where true");
        List<Object> params = new ArrayList<>();
        if (f.de() != null) {
            sql.append(" and registrado_em >= ?");
            params.add(Timestamp.from(f.de()));
        }
        if (f.ate() != null) {
            sql.append(" and registrado_em < ?");
            params.add(Timestamp.from(f.ate()));
        }
        if (f.usuario() != null && !f.usuario().isBlank()) {
            sql.append(" and (autor_nome ilike ? escape '\\' or autor_subject = ?)");
            params.add("%" + escapar(f.usuario().trim()) + "%");
            params.add(f.usuario().trim());
        }
        if (f.acao() != null && !f.acao().isBlank()) {
            sql.append(" and acao = ?");
            params.add(f.acao());
        }
        if (f.entidade() != null && !f.entidade().isBlank()) {
            sql.append(" and entidade = ?");
            params.add(f.entidade());
        }
        if (f.entidadeId() != null && !f.entidadeId().isBlank()) {
            sql.append(" and entidade_id = ?");
            params.add(f.entidadeId().trim());
        }
        sql.append(" order by registrado_em desc, id desc limit ? offset ?");
        params.add(limite);
        params.add(deslocamento);
        return jdbc.sql(sql.toString()).params(params).query(this::mapear).list();
    }

    @Override
    public List<String> acoes() {
        return jdbc.sql("select distinct acao from evento_auditoria order by acao").query(String.class).list();
    }

    @Override
    public List<String> entidades() {
        return jdbc.sql("select distinct entidade from evento_auditoria order by entidade").query(String.class).list();
    }

    @Override
    public boolean existeOutraAcao(String entidade, String entidadeId, List<String> acoesIgnoradas) {
        List<Object> params = new ArrayList<>(List.of(entidade, entidadeId));
        params.addAll(acoesIgnoradas);
        String marcadores = String.join(", ", Collections.nCopies(acoesIgnoradas.size(), "?"));
        return jdbc.sql("select exists (select 1 from evento_auditoria where entidade = ? and entidade_id = ?"
                + (acoesIgnoradas.isEmpty() ? "" : " and acao not in (" + marcadores + ")") + ")")
                .params(params).query(Boolean.class).single();
    }

    private EventoAuditoria mapear(ResultSet rs, int i) throws SQLException {
        return new EventoAuditoria(rs.getLong("id"), rs.getTimestamp("registrado_em").toInstant(),
                rs.getString("autor_subject"), rs.getString("autor_nome"), rs.getString("perfil"), rs.getString("ip"),
                rs.getString("acao"), rs.getString("entidade"), rs.getString("entidade_id"),
                json.readValue(rs.getString("detalhes"), MAPA));
    }

    private static String escapar(String texto) {
        return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
