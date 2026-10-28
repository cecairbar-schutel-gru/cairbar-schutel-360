package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.FotoSolicitacao;
import com.durvalcrm.estoque.domain.MotivoBaixa;

/** Pedido de baixa (US-INVENTORY-007); {@code remessaId} nulo é o estoque próprio. */
public record NovaBaixaCommand(Long produtoId, Long remessaId, Integer quantidade, MotivoBaixa motivo,
        String justificativa, FotoSolicitacao foto) {
}
