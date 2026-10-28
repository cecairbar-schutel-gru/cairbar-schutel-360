package com.durvalcrm.estoque.adapter.out.fechamento;

import com.durvalcrm.fechamento.application.SolicitacoesEstoquePendentesPort;
import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Item "Solicitações de estoque" do checklist do fechamento (US-CLOSING-001): baixa, preço e inativação. */
@Component
class SolicitacoesParaFechamentoAdapter implements SolicitacoesEstoquePendentesPort {

    private final JdbcClient jdbc;

    SolicitacoesParaFechamentoAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long pendentesFeitasAntesDe(Instant limite) {
        return jdbc.sql("select count(*) from solicitacao_estoque where status = 'PENDENTE' and solicitada_em < ?")
                .param(Timestamp.from(limite)).query(Long.class).single();
    }
}
