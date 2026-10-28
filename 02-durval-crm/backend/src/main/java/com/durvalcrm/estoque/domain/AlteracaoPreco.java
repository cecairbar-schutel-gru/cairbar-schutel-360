package com.durvalcrm.estoque.domain;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Linha do histórico de preços (US-INVENTORY-012/013). {@code solicitadoPor} é nulo quando o
 * Administrador altera diretamente o preço de um livro.
 */
public record AlteracaoPreco(long produtoId, BigDecimal precoAnterior, BigDecimal precoNovo, Instant alteradoEm,
        String solicitadoPor, String aprovadoPor, String motivo) {
}
