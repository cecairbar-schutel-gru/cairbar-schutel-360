package com.durvalcrm.financeiro.domain;

public enum TipoConta {
    CAIXA,
    BANCO,
    /** Conta única que recebe as vendas e contribuições em cartão até a liquidação (US-FINANCIAL-004). */
    CARTAO_A_RECEBER
}
