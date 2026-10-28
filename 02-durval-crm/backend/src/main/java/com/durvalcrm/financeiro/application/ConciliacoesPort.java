package com.durvalcrm.financeiro.application;

import java.time.LocalDate;
import java.util.Map;

/**
 * Até quando cada conta bancária está conciliada, para o painel do Tesoureiro (wireframe 3).
 * Implementada pelo módulo Conciliação, para que o Financeiro não dependa dele.
 */
public interface ConciliacoesPort {

    /** Data final da última conciliação concluída, por conta bancária. */
    Map<Long, LocalDate> conciliadasAte();
}
