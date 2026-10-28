package com.durvalcrm.editora.domain;

/**
 * Situação gravada da remessa. "Encerrada" também é mostrada quando todos os itens chegam a zero
 * (US-PUBLISHER-005), sem mudar o que está gravado: uma venda cancelada pode devolver unidades.
 */
public enum StatusRemessa {
    ABERTA,
    ENCERRADA,
    CANCELADA
}
