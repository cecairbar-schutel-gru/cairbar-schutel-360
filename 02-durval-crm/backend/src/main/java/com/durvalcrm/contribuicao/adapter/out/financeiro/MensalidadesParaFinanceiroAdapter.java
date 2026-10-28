package com.durvalcrm.contribuicao.adapter.out.financeiro;

import com.durvalcrm.financeiro.application.MensalidadesDoMesPort;
import java.sql.Date;
import java.time.YearMonth;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Entrega ao painel do Tesoureiro a situação das mensalidades do mês. Fica no módulo Contribuições
 * para que o Financeiro nunca dependa dele (ver {@code ArquiteturaTest}).
 */
@Component
class MensalidadesParaFinanceiroAdapter implements MensalidadesDoMesPort {

    private final JdbcClient jdbc;

    MensalidadesParaFinanceiroAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ResumoMensalidades resumo(YearMonth mes) {
        Date inicio = Date.valueOf(mes.atDay(1));
        return jdbc.sql("""
                select coalesce(sum(case when mes = ? and status in ('PAGA', 'PENDENTE') then valor end), 0) as previsto,
                       coalesce(sum(case when mes = ? and status = 'PAGA' then valor end), 0) as recebido,
                       coalesce(sum(case when mes = ? and status = 'PENDENTE' then valor end), 0) as pendente,
                       coalesce(sum(case when mes < ? and status = 'PENDENTE' then valor end), 0) as anterior
                from competencia where mes <= ?""")
                .params(inicio, inicio, inicio, inicio, inicio)
                .query((rs, i) -> new ResumoMensalidades(rs.getBigDecimal("previsto"), rs.getBigDecimal("recebido"),
                        rs.getBigDecimal("pendente"), rs.getBigDecimal("anterior")))
                .single();
    }
}
