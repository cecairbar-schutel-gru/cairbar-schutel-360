package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.application.ExecucaoGeracao;
import com.durvalcrm.contribuicao.application.ExecucoesGeracaoPort;
import java.sql.Timestamp;
import java.time.YearMonth;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ExecucoesGeracaoJdbcAdapter implements ExecucoesGeracaoPort {

    private final JdbcClient jdbc;

    ExecucoesGeracaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<ExecucaoGeracao> buscar(YearMonth mes) {
        return jdbc.sql("""
                select situacao, tentativas, ultima_tentativa, criadas, duracao_ms, erro
                from execucao_geracao_competencias where mes = :mes""")
                .param("mes", mes.atDay(1))
                .query((rs, i) -> new ExecucaoGeracao(mes, ExecucaoGeracao.Situacao.valueOf(rs.getString("situacao")),
                        rs.getInt("tentativas"), rs.getTimestamp("ultima_tentativa").toInstant(), rs.getInt("criadas"),
                        rs.getLong("duracao_ms"), rs.getString("erro")))
                .optional();
    }

    @Override
    public void salvar(ExecucaoGeracao e) {
        jdbc.sql("""
                insert into execucao_geracao_competencias
                    (mes, situacao, tentativas, ultima_tentativa, criadas, duracao_ms, erro)
                values (:mes, :situacao, :tentativas, :ultima, :criadas, :duracao, :erro)
                on conflict (mes) do update set situacao = excluded.situacao, tentativas = excluded.tentativas,
                    ultima_tentativa = excluded.ultima_tentativa, criadas = excluded.criadas,
                    duracao_ms = excluded.duracao_ms, erro = excluded.erro""")
                .param("mes", e.mes().atDay(1))
                .param("situacao", e.situacao().name())
                .param("tentativas", e.tentativas())
                .param("ultima", Timestamp.from(e.ultimaTentativa()))
                .param("criadas", e.criadas())
                .param("duracao", e.duracaoMs())
                .param("erro", e.erro())
                .update();
    }
}
