package com.durvalcrm.contapagar.domain;

import java.util.List;
import java.util.Optional;

public interface ContaPagarRepository {

    /** Ativas e encerradas, por descrição. */
    List<ContaPagar> listar();

    Optional<ContaPagar> obter(long id);

    /** {@code SELECT … FOR UPDATE}: serializa os pagamentos da conta (um por vencimento). */
    Optional<ContaPagar> travar(long id);

    /** Insere (sem id) ou atualiza, devolvendo com id. */
    ContaPagar salvar(ContaPagar conta);

    /** Só para conta sem pagamentos. */
    void excluir(long id);
}
