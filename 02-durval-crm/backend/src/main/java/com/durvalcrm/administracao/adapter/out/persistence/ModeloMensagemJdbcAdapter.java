package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.ModeloMensagem;
import com.durvalcrm.administracao.domain.ModeloMensagemRepository;
import com.durvalcrm.administracao.domain.TipoModelo;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ModeloMensagemJdbcAdapter implements ModeloMensagemRepository {

    private final JdbcClient jdbc;

    ModeloMensagemJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ModeloMensagem> listar() {
        return jdbc.sql("select * from modelo_mensagem order by tipo").query(ModeloMensagemJdbcAdapter::mapear).list();
    }

    @Override
    public ModeloMensagem buscar(TipoModelo tipo) {
        return jdbc.sql("select * from modelo_mensagem where tipo = ?").param(tipo.name())
                .query(ModeloMensagemJdbcAdapter::mapear).single();
    }

    @Override
    public void salvar(ModeloMensagem m) {
        jdbc.sql("""
                update modelo_mensagem set whatsapp = ?, email_assunto = ?, email_corpo = ?, atualizado_por = ?,
                    atualizado_por_nome = ?, atualizado_em = ? where tipo = ?""")
                .params(m.whatsapp(), m.emailAssunto(), m.emailCorpo(), m.atualizacao().subject(),
                        m.atualizacao().nome(), Timestamp.from(m.atualizacao().em()), m.tipo().name())
                .update();
    }

    private static ModeloMensagem mapear(ResultSet rs, int i) throws SQLException {
        Timestamp em = rs.getTimestamp("atualizado_em");
        return new ModeloMensagem(TipoModelo.valueOf(rs.getString("tipo")), rs.getString("whatsapp"),
                rs.getString("email_assunto"), rs.getString("email_corpo"), em == null ? null
                        : new Autor(rs.getString("atualizado_por"), rs.getString("atualizado_por_nome"), em.toInstant()));
    }
}
