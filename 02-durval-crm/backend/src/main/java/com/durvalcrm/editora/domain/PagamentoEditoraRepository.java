package com.durvalcrm.editora.domain;

import java.util.Optional;

public interface PagamentoEditoraRepository {

    /** Novo (sem id): grava com as alocações. Existente: lançamento e data de estorno. */
    PagamentoEditora salvar(PagamentoEditora pagamento);

    Optional<PagamentoEditora> obter(long id);

    Optional<PagamentoEditora> travar(long id);

    Optional<PagamentoEditora> porChave(String chaveIdempotencia);
}
