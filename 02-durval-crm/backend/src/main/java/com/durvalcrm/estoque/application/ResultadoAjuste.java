package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.TipoMovimento;

/**
 * Ajuste após contagem (US-INVENTORY-016). Uma diminuição em remessa consignada vira baixa por
 * extravio aprovada ({@code solicitacaoId}), que gera a obrigação com a editora.
 */
public record ResultadoAjuste(int saldoAnterior, int quantidadeContada, int diferenca, TipoMovimento tipo,
        Long solicitacaoId) {
}
