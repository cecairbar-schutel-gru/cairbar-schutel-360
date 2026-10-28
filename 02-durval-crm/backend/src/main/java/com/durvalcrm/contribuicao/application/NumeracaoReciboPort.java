package com.durvalcrm.contribuicao.application;

/** Sequência anual de recibos, gerada dentro da transação da contribuição ("2026-000123"). */
public interface NumeracaoReciboPort {

    String proximo(int ano);
}
