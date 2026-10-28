package com.durvalcrm.financeiro.domain;

public interface ContasRecebimentoRepository {

    /** Sem registro, {@link ContasRecebimento#NENHUMA}. */
    ContasRecebimento obter();

    void salvar(ContasRecebimento contas, Lancamento.Autor autor);
}
