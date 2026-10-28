package com.durvalcrm.venda.adapter.out.persistence;

import com.durvalcrm.venda.application.NumeracaoVendaPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Sequência sem lacunas: o upsert trava a linha única até o fim da transação da venda, e um
 * rollback devolve o número.
 */
@Component
class NumeracaoVendaJdbcAdapter implements NumeracaoVendaPort {

    private final JdbcClient jdbc;

    NumeracaoVendaJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public long proximo() {
        return jdbc.sql("""
                insert into sequencia_venda (id, ultimo) values (1, 1)
                on conflict (id) do update set ultimo = sequencia_venda.ultimo + 1
                returning ultimo""")
                .query(Long.class)
                .single();
    }
}
