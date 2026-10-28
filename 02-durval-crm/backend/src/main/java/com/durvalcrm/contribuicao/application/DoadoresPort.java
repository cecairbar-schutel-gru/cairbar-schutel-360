package com.durvalcrm.contribuicao.application;

import java.util.List;
import java.util.Optional;

/** Dados do doador de que o módulo Contribuições precisa, fornecidos pelo módulo Doador. */
public interface DoadoresPort {

    Optional<DoadorResumo> buscar(long doadorId);

    List<Long> listarIdsAtivos();

    record DoadorResumo(long id, String nome, boolean ativo, boolean anonimizado) {
    }
}
