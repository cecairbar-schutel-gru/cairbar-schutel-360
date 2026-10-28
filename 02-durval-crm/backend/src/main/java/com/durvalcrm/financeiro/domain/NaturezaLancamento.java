package com.durvalcrm.financeiro.domain;

/** Tipo do lançamento para filtros e relatórios (US-FINANCIAL-005). */
public enum NaturezaLancamento {
    RECEITA,
    DESPESA,
    /** Entre contas próprias: não é receita nem despesa (US-FINANCIAL-003). */
    TRANSFERENCIA,
    /** Liquidação de cartão: Cartão a receber → banco, com a taxa como despesa (US-FINANCIAL-004). */
    LIQUIDACAO,
    ESTORNO
}
