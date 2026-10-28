package com.durvalcrm.financeiro.application;

/**
 * Módulo que precisa reagir quando um lançamento seu é estornado direto no Financeiro
 * (US-FINANCIAL-010), como o pagamento a editora, que reabre as obrigações cobertas. Implementada
 * pelo módulo de origem, para que o Financeiro não dependa dele. Roda na transação do estorno.
 */
public interface EstornoNaOrigemPort {

    /** {@code origem_tipo} dos lançamentos que interessam (ver {@code OrigemLancamento}). */
    String origemTipo();

    void lancamentoEstornado(long origemId);
}
