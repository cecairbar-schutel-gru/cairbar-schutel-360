package com.durvalcrm.financeiro.domain;

import java.util.List;

public interface ClassificacaoRepository {

    /** Troca a categoria da linha e registra o histórico. */
    void reclassificar(Reclassificacao reclassificacao);

    List<Reclassificacao> historico(long lancamentoId);
}
