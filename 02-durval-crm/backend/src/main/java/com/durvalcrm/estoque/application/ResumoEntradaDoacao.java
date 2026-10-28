package com.durvalcrm.estoque.application;

import java.time.Instant;
import java.util.List;

/** Entrada por doação na lista (US-INVENTORY-006); {@code cancelavel} enquanto as unidades estão no estoque. */
public record ResumoEntradaDoacao(long id, Instant registradaEm, String registradaPorNome, String observacao,
        List<Item> itens, Instant canceladaEm, String canceladaPorNome, String motivoCancelamento,
        boolean cancelavel) {

    public record Item(long produtoId, String produtoNome, int quantidade) {
    }
}
