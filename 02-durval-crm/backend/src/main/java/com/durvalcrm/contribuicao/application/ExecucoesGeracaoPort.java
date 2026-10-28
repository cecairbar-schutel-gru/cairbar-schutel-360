package com.durvalcrm.contribuicao.application;

import java.time.YearMonth;
import java.util.Optional;

public interface ExecucoesGeracaoPort {

    Optional<ExecucaoGeracao> buscar(YearMonth mes);

    void salvar(ExecucaoGeracao execucao);
}
