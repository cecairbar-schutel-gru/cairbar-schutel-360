package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.Importacao;
import com.durvalcrm.administracao.domain.ImportacaoRepository;
import com.durvalcrm.administracao.domain.TipoImportacao;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Component
class ImportacaoJdbcAdapter implements ImportacaoRepository {

    private static final TypeReference<List<Long>> IDS = new TypeReference<>() {
    };
    private static final TypeReference<List<String>> MESES = new TypeReference<>() {
    };

    private final JdbcClient jdbc;
    private final JsonMapper json;

    ImportacaoJdbcAdapter(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public Importacao inserir(Importacao i) {
        long id = jdbc.sql("""
                insert into importacao (tipo, arquivo, usuario, usuario_nome, registrada_em, linhas_total,
                    linhas_importadas, status) values (?, ?, ?, ?, ?, ?, 0, 'CONCLUIDA') returning id""")
                .params(i.tipo().name(), i.arquivo(), i.autor().subject(), i.autor().nome(),
                        Timestamp.from(i.autor().em()), i.linhasTotal())
                .query(Long.class).single();
        return new Importacao(id, i.tipo(), i.arquivo(), i.autor(), i.linhasTotal(), 0, List.of(), List.of(), false,
                null);
    }

    @Override
    public void registrarResultado(Importacao i) {
        jdbc.sql("update importacao set linhas_importadas = ?, criados = ?::jsonb, meses_fechados = ?::jsonb where id = ?")
                .params(i.linhasImportadas(), json.writeValueAsString(i.criados()),
                        json.writeValueAsString(i.mesesFechados().stream().map(YearMonth::toString).toList()), i.id())
                .update();
    }

    @Override
    public Optional<Importacao> travar(long id) {
        return jdbc.sql("select * from importacao where id = ? for update").param(id).query(this::mapear).optional();
    }

    @Override
    public List<Importacao> listar() {
        return jdbc.sql("select * from importacao order by registrada_em desc, id desc").query(this::mapear).list();
    }

    @Override
    public void marcarDesfeita(long id, Autor autor) {
        jdbc.sql("""
                update importacao set status = 'DESFEITA', desfeita_em = ?, desfeita_por = ?, desfeita_por_nome = ?
                where id = ?""")
                .params(Timestamp.from(autor.em()), autor.subject(), autor.nome(), id)
                .update();
    }

    private Importacao mapear(ResultSet rs, int i) throws SQLException {
        Timestamp desfeita = rs.getTimestamp("desfeita_em");
        return new Importacao(rs.getLong("id"), TipoImportacao.valueOf(rs.getString("tipo")), rs.getString("arquivo"),
                new Autor(rs.getString("usuario"), rs.getString("usuario_nome"),
                        rs.getTimestamp("registrada_em").toInstant()),
                rs.getInt("linhas_total"), rs.getInt("linhas_importadas"), json.readValue(rs.getString("criados"), IDS),
                json.readValue(rs.getString("meses_fechados"), MESES).stream().map(YearMonth::parse).toList(),
                "DESFEITA".equals(rs.getString("status")),
                desfeita == null ? null : new Autor(rs.getString("desfeita_por"), rs.getString("desfeita_por_nome"),
                        desfeita.toInstant()));
    }
}
