package com.durvalcrm.administracao.domain;

import java.util.List;

public interface ValorMensalidadeRepository {

    /** Todos os valores, do mais antigo ao mais recente. */
    List<ValorMensalidade> listar();

    /** Trava a tabela até o fim da transação: um agendamento de cada vez. */
    void travar();

    ValorMensalidade inserir(ValorMensalidade valor);

    void atualizar(ValorMensalidade valor);

    void excluir(long id);
}
