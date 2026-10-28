package com.durvalcrm.estoque.domain;

import java.util.List;

public interface EstoqueRepository {

    /**
     * Trava ({@code SELECT … FOR UPDATE}) os lotes do produto até o fim da transação e os devolve na
     * ordem de saída: o próprio primeiro, depois as remessas pela data de recebimento e código.
     */
    List<Lote> travarLotes(long produtoId);

    /** Os mesmos lotes de {@link #travarLotes}, sem travar (consultas e validação de pedidos). */
    List<Lote> lotes(long produtoId);

    /** Soma {@code delta} ao lote (criando o lote se não existir); o saldo nunca fica negativo. */
    void ajustarLote(long produtoId, Long remessaId, int delta);

    void registrar(MovimentoEstoque movimento);

    /** Movimentos do produto do mais antigo para o mais novo. */
    List<MovimentoEstoque> movimentos(long produtoId);

    List<MovimentoEstoque> movimentosDaReferencia(String referenciaTipo, long referenciaId);

    /** Movimentos dos lotes de uma remessa consignada, do mais antigo para o mais novo. */
    List<MovimentoEstoque> movimentosDaRemessa(long remessaId);

    /** Se o produto tem algum movimento, remessa, venda ou solicitação (não pode mais ser excluído). */
    boolean possuiHistorico(long produtoId);
}
