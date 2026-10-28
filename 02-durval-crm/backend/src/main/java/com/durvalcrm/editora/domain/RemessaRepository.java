package com.durvalcrm.editora.domain;

import java.util.Optional;

public interface RemessaRepository {

    Optional<ItemRemessa> item(long remessaId, long produtoId);

    Optional<Remessa> obter(long id);

    /** {@code SELECT … FOR UPDATE} da remessa. */
    Optional<Remessa> travar(long id);

    /** Nova (sem id): gera o código pela sequência do ano de recebimento e grava os itens. Existente: situação e cancelamento. */
    Remessa salvar(Remessa remessa);

    /** Pedido de baixa pendente para um lote da remessa (US-INVENTORY-007). */
    boolean possuiBaixaPendente(long remessaId);
}
