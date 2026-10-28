package com.durvalcrm.administracao.domain;

import java.util.List;
import java.util.Optional;

public interface ImportacaoRepository {

    Importacao inserir(Importacao importacao);

    /** Linhas importadas, ids criados e meses fechados. */
    void registrarResultado(Importacao importacao);

    /** Com a linha travada até o fim da transação. */
    Optional<Importacao> travar(long id);

    List<Importacao> listar();

    void marcarDesfeita(long id, Autor autor);
}
