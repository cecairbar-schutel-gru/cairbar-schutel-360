package com.durvalcrm.financeiro.domain;

import java.util.Optional;

public interface AnexoLancamentoRepository {

    void salvar(long lancamentoId, AnexoLancamento anexo);

    Optional<AnexoLancamento> obter(long lancamentoId);
}
