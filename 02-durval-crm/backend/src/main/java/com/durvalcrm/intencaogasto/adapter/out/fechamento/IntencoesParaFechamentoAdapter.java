package com.durvalcrm.intencaogasto.adapter.out.fechamento;

import com.durvalcrm.fechamento.application.IntencoesEmAbertoPort;
import java.sql.Timestamp;
import java.time.Instant;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Item "Intenções de gasto" do checklist do fechamento (US-CLOSING-001): pendentes e divergentes. */
@Component
class IntencoesParaFechamentoAdapter implements IntencoesEmAbertoPort {

    private final JdbcClient jdbc;

    IntencoesParaFechamentoAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long emAbertoCriadasAntesDe(Instant limite) {
        return jdbc.sql("""
                select count(*) from intencao_gasto
                where status in ('PENDENTE', 'DIVERGENTE') and criada_em < ?""")
                .param(Timestamp.from(limite)).query(Long.class).single();
    }
}
