package com.durvalcrm.intencaogasto.adapter.out.financeiro;

import com.durvalcrm.financeiro.application.IntencoesPendentesPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Entrega ao painel do Tesoureiro quantas intenções esperam decisão. Fica no módulo Intenções de
 * gasto para que o Financeiro nunca dependa dele (ver {@code ArquiteturaTest}).
 */
@Component
class IntencoesParaFinanceiroAdapter implements IntencoesPendentesPort {

    private final JdbcClient jdbc;

    IntencoesParaFinanceiroAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long pendentes() {
        return jdbc.sql("select count(*) from intencao_gasto where status = 'PENDENTE'").query(Long.class).single();
    }
}
