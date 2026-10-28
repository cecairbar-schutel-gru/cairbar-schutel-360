package com.durvalcrm.intencaogasto.domain;

/** Situações da intenção de gasto (devplan/07-expense-requests). */
public enum StatusIntencao {
    /** Aguarda a decisão do Tesoureiro ou do Administrador. */
    PENDENTE,
    /** Despesa lançada; situação final das intenções que não são compra da cantina. */
    APROVADA,
    /** Compra da cantina aprovada, à espera da conferência do Vendedor. */
    AGUARDANDO_RECEBIMENTO,
    /** O Vendedor relatou diferença: a entrada no estoque fica bloqueada. */
    DIVERGENTE,
    /** Compra da cantina recebida e estoque atualizado. */
    RECEBIDA,
    REJEITADA,
    /** Retirada pelo solicitante antes da decisão ou cancelada após divergência (despesa estornada). */
    CANCELADA
}
