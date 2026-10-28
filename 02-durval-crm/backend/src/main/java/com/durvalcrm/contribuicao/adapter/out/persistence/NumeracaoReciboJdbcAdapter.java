package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.application.NumeracaoReciboPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Sequência anual sem lacunas: o upsert trava a linha do ano até o fim da transação da
 * contribuição, e um rollback devolve o número.
 */
@Component
class NumeracaoReciboJdbcAdapter implements NumeracaoReciboPort {

    private final JdbcClient jdbc;

    NumeracaoReciboJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public String proximo(int ano) {
        int numero = jdbc.sql("""
                insert into sequencia_recibo (ano, ultimo) values (:ano, 1)
                on conflict (ano) do update set ultimo = sequencia_recibo.ultimo + 1
                returning ultimo""")
                .param("ano", ano)
                .query(Integer.class)
                .single();
        return String.format("%d-%06d", ano, numero);
    }
}
