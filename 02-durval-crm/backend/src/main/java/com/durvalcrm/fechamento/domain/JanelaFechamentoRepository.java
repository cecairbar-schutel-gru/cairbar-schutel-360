package com.durvalcrm.fechamento.domain;

import java.util.Optional;

public interface JanelaFechamentoRepository {

    /** Vazio enquanto ninguém gravou a janela (vale {@link JanelaFechamento#PADRAO}). */
    Optional<JanelaFechamento> buscar();

    void salvar(JanelaFechamento janela);
}
