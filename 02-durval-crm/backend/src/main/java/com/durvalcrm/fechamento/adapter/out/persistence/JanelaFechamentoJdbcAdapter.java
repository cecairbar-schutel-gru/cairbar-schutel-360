package com.durvalcrm.fechamento.adapter.out.persistence;

import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.JanelaFechamento;
import com.durvalcrm.fechamento.domain.JanelaFechamentoRepository;
import java.sql.Timestamp;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class JanelaFechamentoJdbcAdapter implements JanelaFechamentoRepository {

    private final JdbcClient jdbc;

    JanelaFechamentoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<JanelaFechamento> buscar() {
        return jdbc.sql("select * from janela_fechamento where id = 1")
                .query((rs, i) -> new JanelaFechamento(rs.getInt("dia_inicio"), rs.getInt("dia_fim"),
                        new Autor(rs.getString("atualizado_por"), rs.getString("atualizado_por_nome"),
                                rs.getTimestamp("atualizado_em").toInstant())))
                .optional();
    }

    @Override
    public void salvar(JanelaFechamento j) {
        jdbc.sql("""
                insert into janela_fechamento (id, dia_inicio, dia_fim, atualizado_por, atualizado_por_nome, atualizado_em)
                values (1, ?, ?, ?, ?, ?)
                on conflict (id) do update set dia_inicio = excluded.dia_inicio, dia_fim = excluded.dia_fim,
                    atualizado_por = excluded.atualizado_por, atualizado_por_nome = excluded.atualizado_por_nome,
                    atualizado_em = excluded.atualizado_em""")
                .params(j.diaInicio(), j.diaFim(), j.alteracao().subject(), j.alteracao().nome(),
                        Timestamp.from(j.alteracao().em()))
                .update();
    }
}
