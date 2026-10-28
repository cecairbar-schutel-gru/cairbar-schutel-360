package com.durvalcrm.financeiro.domain;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface LancamentoRepository {

    Lancamento salvar(Lancamento lancamento);

    Optional<Lancamento> buscarPorId(long id);

    List<Lancamento> buscarTodos(Collection<Long> ids);

    Optional<Lancamento> buscarPorChave(String chaveIdempotencia);

    boolean existeEstornoDe(long lancamentoId);

    /** Saldo inicial da conta mais a soma das suas linhas a partir da data de corte. */
    BigDecimal saldo(long contaId);

    boolean contaTemLancamentos(long contaId);

    /** Alguma linha deste lançamento já foi conciliada (US-RECONCILIATION)? */
    boolean conciliado(long lancamentoId);

    /** Nenhum lançamento da origem foi estornado, reclassificado, conciliado ou ganhou anexo. */
    boolean origemIntocada(String origemTipo, long origemId);

    /** Só para desfazer uma importação (US-ADMIN-012): lançamentos nunca são excluídos de outra forma. */
    int excluirDaOrigem(String origemTipo, long origemId);
}
