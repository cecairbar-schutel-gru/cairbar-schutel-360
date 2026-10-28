package com.durvalcrm.financeiro.application;

import java.math.BigDecimal;
import java.time.YearMonth;

/**
 * Situação das mensalidades do mês para o painel do Tesoureiro (wireframe 3). Implementada pelo
 * módulo Contribuições, para que o Financeiro não dependa dele.
 */
public interface MensalidadesDoMesPort {

    ResumoMensalidades resumo(YearMonth mes);

    /**
     * @param previsto         competências do mês, pagas ou pendentes
     * @param recebido         competências do mês já pagas
     * @param pendente         competências do mês ainda pendentes
     * @param pendenteAnterior competências de meses anteriores ainda pendentes
     */
    record ResumoMensalidades(BigDecimal previsto, BigDecimal recebido, BigDecimal pendente,
            BigDecimal pendenteAnterior) {
    }
}
