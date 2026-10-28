package com.durvalcrm.editora.domain;

import java.util.List;
import java.util.Optional;

public interface PedidoLivrosRepository {

    Optional<PedidoLivros> obter(long id);

    /** {@code SELECT … FOR UPDATE} do pedido. */
    Optional<PedidoLivros> travar(long id);

    /** Pedido recebido pela remessa, travado. */
    Optional<PedidoLivros> travarDaRemessa(long remessaId);

    /** Mais recentes primeiro; filtros opcionais. */
    List<PedidoLivros> listar(Long editoraId, StatusPedidoLivros status);

    /** Novo (sem id): grava os itens. Existente: situação, remessa e cancelamento. */
    PedidoLivros salvar(PedidoLivros pedido);
}
