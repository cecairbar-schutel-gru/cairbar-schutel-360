package com.durvalcrm.estoque.domain;

/** Tipos de movimento do histórico (US-INVENTORY-010); o estorno aponta o movimento que reverte. */
public enum TipoMovimento {
    VENDA,
    CANCELAMENTO_VENDA,
    ENTRADA_COMPRA,
    ENTRADA_DOACAO,
    ENTRADA_REMESSA,
    DEVOLUCAO_EDITORA,
    BAIXA_VENCIMENTO,
    BAIXA_DANO,
    BAIXA_EXTRAVIO,
    AJUSTE,
    ESTORNO;

    public static TipoMovimento baixa(MotivoBaixa motivo) {
        return switch (motivo) {
            case VENCIMENTO -> BAIXA_VENCIMENTO;
            case DANO -> BAIXA_DANO;
            case EXTRAVIO -> BAIXA_EXTRAVIO;
        };
    }

    /** Entradas que contam como "última entrada" na tela de estoque. */
    public boolean entrada() {
        return this == ENTRADA_COMPRA || this == ENTRADA_DOACAO || this == ENTRADA_REMESSA;
    }
}
