package com.durvalcrm.fechamento.application;

import java.time.Instant;

/**
 * Item 2 do checklist (US-EXPENSE-002, 007): intenções de gasto pendentes ou divergentes criadas antes
 * do limite. Implementada pelo módulo Intenções de gasto.
 */
public interface IntencoesEmAbertoPort {

    long emAbertoCriadasAntesDe(Instant limite);
}
