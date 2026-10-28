package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Saldos por tipo de conta, com subtotais e total geral (US-FINANCIAL-002). O saldo é nulo quando a
 * data pedida é anterior à data de corte da conta.
 */
public record QuadroSaldos(LocalDate data, List<SaldoConta> caixas, List<SaldoConta> bancos, SaldoConta cartaoAReceber,
        BigDecimal subtotalCaixas, BigDecimal subtotalBancos, BigDecimal total) {

    public record SaldoConta(ContaFinanceira conta, BigDecimal saldo) {
    }
}
