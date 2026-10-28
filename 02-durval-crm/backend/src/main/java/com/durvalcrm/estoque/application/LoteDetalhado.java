package com.durvalcrm.estoque.application;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Saldo de um lote no detalhe do produto: próprio ({@code remessaId} nulo) ou por remessa. */
public record LoteDetalhado(Long remessaId, String remessaCodigo, LocalDate recebidaEm, int quantidade,
        int aguardandoBaixa, BigDecimal repassePercentual) {
}
