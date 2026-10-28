package com.durvalcrm.estoque.domain;

import java.util.Optional;

public interface SolicitacaoRepository {

    /** Insere (sem id) ou atualiza status e decisão. */
    Solicitacao salvar(Solicitacao solicitacao);

    Optional<Solicitacao> obter(long id);

    /** Unidades do lote em pedidos de baixa pendentes ("aguardando baixa"). */
    int pendenteDeBaixa(long produtoId, Long remessaId);

    boolean existePendente(long produtoId, TipoSolicitacao tipo);
}
