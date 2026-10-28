package com.durvalcrm.fechamento.domain;

/** Mês sem registro está aberto; só o Administrador reabre um mês fechado (US-CLOSING-009). */
public enum StatusPeriodo {
    ABERTO,
    FECHADO,
    /** Aceita lançamentos de novo até passar pelo checklist e ser fechado outra vez. */
    REABERTO
}
