package com.durvalcrm.conciliacao.domain;

import java.util.Optional;

public interface ConciliacaoRepository {

    /** Insere (id nulo) ou atualiza a sessão. */
    Conciliacao salvar(Conciliacao conciliacao);

    Optional<Conciliacao> buscarPorId(long id);

    /** Trava a sessão até o fim da transação (marcações e conclusão em série). */
    Optional<Conciliacao> travar(long id);

    Optional<Conciliacao> emAndamento(long contaId);

    /** Sessão concluída com a maior data final: ponto de partida da próxima. */
    Optional<Conciliacao> ultimaConcluida(long contaId);
}
