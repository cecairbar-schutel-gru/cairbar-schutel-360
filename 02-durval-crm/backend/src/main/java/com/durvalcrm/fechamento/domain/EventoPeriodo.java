package com.durvalcrm.fechamento.domain;

import java.time.YearMonth;

/**
 * Linha do histórico do período (US-CLOSING-009): fechamentos, reaberturas, confirmação do cartão e
 * o fechamento dos meses do histórico importado (US-ADMIN-012).
 */
public record EventoPeriodo(YearMonth mes, TipoEvento evento, Autor autor, String texto, Integer versao) {

    public enum TipoEvento {
        FECHAMENTO,
        REABERTURA,
        CARTAO_CONFIRMADO,
        IMPORTACAO
    }
}
