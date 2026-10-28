package com.durvalcrm.fechamento.adapter.out.financeiro;

import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import java.sql.Date;
import java.time.YearMonth;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * A trava única dos meses fechados (US-CLOSING-008), consultada por todo lançamento do Financeiro e
 * pelos módulos que aceitam datas (conciliação, remessas e devoluções). Fica no módulo Fechamento para
 * que o Financeiro nunca dependa dele (ver {@code ArquiteturaTest}).
 */
@Component
class PeriodosParaFinanceiroAdapter implements PeriodoFinanceiroPort {

    private final JdbcClient jdbc;

    PeriodosParaFinanceiroAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean estaFechado(YearMonth mes) {
        return jdbc.sql("select count(*) from periodo where mes = ? and status = 'FECHADO'")
                .param(Date.valueOf(mes.atDay(1))).query(Long.class).single() > 0;
    }
}
