package com.durvalcrm.contapagar.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PagamentoContaPagarRepository {

    Optional<PagamentoContaPagar> porChave(String chave);

    Optional<PagamentoContaPagar> travar(long id);

    /** Todos os pagamentos da conta, inclusive os estornados, do vencimento mais recente ao mais antigo. */
    List<PagamentoContaPagar> daConta(long contaPagarId);

    /** Pagamentos não estornados com vencimento até {@code ate}, de todas as contas. */
    List<PagamentoContaPagar> validosAte(LocalDate ate);

    boolean pago(long contaPagarId, LocalDate vencimento);

    boolean existeDaConta(long contaPagarId);

    /** Insere (sem id) ou atualiza, devolvendo com id. */
    PagamentoContaPagar salvar(PagamentoContaPagar pagamento);
}
