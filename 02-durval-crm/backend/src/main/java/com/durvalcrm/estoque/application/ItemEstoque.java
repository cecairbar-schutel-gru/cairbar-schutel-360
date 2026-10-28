package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.TipoProduto;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Linha da tela Estoque (wireframe 10, US-INVENTORY-009): saldo disponível separado em próprio e
 * consignado, unidades aguardando baixa (ainda vendáveis) e a última entrada não estornada.
 */
public record ItemEstoque(long id, TipoProduto tipo, String nome, String categoria, String autor, String isbn,
        String editoraNome, BigDecimal preco, boolean ativo, int saldo, int saldoProprio, int saldoConsignado,
        int aguardandoBaixa, Instant ultimaEntrada) {
}
