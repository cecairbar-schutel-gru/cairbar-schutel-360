package com.durvalcrm.conciliacao.adapter.out.financeiro;

import com.durvalcrm.financeiro.application.ConciliacoesPort;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Entrega ao painel do Tesoureiro a data da última conciliação de cada conta. Fica no módulo
 * Conciliação para que o Financeiro nunca dependa dele (ver {@code ArquiteturaTest}).
 */
@Component
class ConciliacoesParaFinanceiroAdapter implements ConciliacoesPort {

    private final JdbcClient jdbc;

    ConciliacoesParaFinanceiroAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Map<Long, LocalDate> conciliadasAte() {
        Map<Long, LocalDate> datas = new HashMap<>();
        jdbc.sql("select conta_id, max(data_fim) from conciliacao where status = 'CONCLUIDA' group by conta_id")
                .query(rs -> {
                    datas.put(rs.getLong(1), rs.getDate(2).toLocalDate());
                });
        return datas;
    }
}
