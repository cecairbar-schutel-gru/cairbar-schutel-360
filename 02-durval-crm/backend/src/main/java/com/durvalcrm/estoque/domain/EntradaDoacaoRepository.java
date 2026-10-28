package com.durvalcrm.estoque.domain;

import java.util.Optional;

public interface EntradaDoacaoRepository {

    /** Insere (sem id) ou grava o cancelamento. Os itens são os movimentos da entrada. */
    EntradaDoacao salvar(EntradaDoacao entrada);

    Optional<EntradaDoacao> obter(long id);
}
