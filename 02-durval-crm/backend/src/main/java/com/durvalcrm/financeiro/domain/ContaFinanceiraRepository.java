package com.durvalcrm.financeiro.domain;

import java.util.List;
import java.util.Optional;

public interface ContaFinanceiraRepository {

    Optional<ContaFinanceira> buscarPorId(long id);

    /** Trava a conta até o fim da transação (saldo conferido antes de lançar). */
    Optional<ContaFinanceira> travar(long id);

    /** Contas ativas do tipo, ordenadas pelo nome. */
    List<ContaFinanceira> listarAtivas(TipoConta tipo);

    /** Todas as contas, por tipo e nome. */
    List<ContaFinanceira> listar();

    ContaFinanceira cartaoAReceber();

    boolean codigoEmUso(String codigo);

    ContaFinanceira salvar(ContaFinanceira conta);

    void excluir(long id);
}
