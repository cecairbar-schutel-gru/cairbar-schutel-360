package com.durvalcrm.venda.application;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Resumo do dia das vendas do Vendedor e das vendas do PDV da cantina (US-SALES-021); canceladas ficam
 * fora dos totais.
 */
public record PainelVendedor(
        LocalDate data,
        int quantidade,
        BigDecimal totalDinheiro,
        BigDecimal totalPix,
        BigDecimal totalCartao,
        int cancelamentos) {
}
