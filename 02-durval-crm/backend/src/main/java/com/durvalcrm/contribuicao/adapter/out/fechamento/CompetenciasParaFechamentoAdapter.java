package com.durvalcrm.contribuicao.adapter.out.fechamento;

import com.durvalcrm.fechamento.application.CompetenciasDoMesPort;
import java.sql.Date;
import java.time.YearMonth;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Resumo das mensalidades do demonstrativo do fechamento (US-CLOSING-007). */
@Component
class CompetenciasParaFechamentoAdapter implements CompetenciasDoMesPort {

    private final JdbcClient jdbc;

    CompetenciasParaFechamentoAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ResumoCompetencias resumo(YearMonth mes) {
        return jdbc.sql("""
                select count(*) as geradas,
                       count(*) filter (where status = 'PAGA') as pagas,
                       count(*) filter (where status = 'PENDENTE') as pendentes,
                       coalesce(sum(valor), 0) as valor_gerado,
                       coalesce(sum(valor) filter (where status = 'PAGA'), 0) as valor_pago,
                       coalesce(sum(valor) filter (where status = 'PENDENTE'), 0) as valor_pendente
                from competencia where mes = ? and status <> 'CANCELADA'""")
                .param(Date.valueOf(mes.atDay(1)))
                .query((rs, i) -> new ResumoCompetencias(rs.getLong("geradas"), rs.getLong("pagas"),
                        rs.getLong("pendentes"), rs.getBigDecimal("valor_gerado"), rs.getBigDecimal("valor_pago"),
                        rs.getBigDecimal("valor_pendente")))
                .single();
    }
}
