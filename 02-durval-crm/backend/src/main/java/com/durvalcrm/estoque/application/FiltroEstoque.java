package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.TipoProduto;

/** Filtros da tela Estoque (US-INVENTORY-009); campos nulos não filtram. */
public record FiltroEstoque(TipoProduto tipo, String categoria, String termoNormalizado, String isbn,
        boolean somenteSemSaldo, SituacaoCatalogo situacao) {
}
