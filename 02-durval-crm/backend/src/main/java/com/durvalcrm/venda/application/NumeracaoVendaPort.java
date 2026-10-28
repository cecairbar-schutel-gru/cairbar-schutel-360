package com.durvalcrm.venda.application;

/** Número sequencial das vendas, gerado dentro da transação da confirmação. */
public interface NumeracaoVendaPort {

    long proximo();
}
