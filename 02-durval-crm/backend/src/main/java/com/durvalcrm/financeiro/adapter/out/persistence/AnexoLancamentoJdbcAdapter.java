package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.AnexoLancamentoRepository;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class AnexoLancamentoJdbcAdapter implements AnexoLancamentoRepository {

    private final JdbcClient jdbc;

    AnexoLancamentoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void salvar(long lancamentoId, AnexoLancamento anexo) {
        jdbc.sql("insert into lancamento_anexo (lancamento_id, nome, tipo, conteudo) values (?, ?, ?, ?)")
                .params(lancamentoId, anexo.nome(), anexo.tipo(), anexo.conteudo())
                .update();
    }

    @Override
    public Optional<AnexoLancamento> obter(long lancamentoId) {
        return jdbc.sql("select nome, tipo, conteudo from lancamento_anexo where lancamento_id = ?")
                .param(lancamentoId)
                .query((rs, i) -> new AnexoLancamento(rs.getString("nome"), rs.getString("tipo"), rs.getBytes("conteudo")))
                .optional();
    }
}
