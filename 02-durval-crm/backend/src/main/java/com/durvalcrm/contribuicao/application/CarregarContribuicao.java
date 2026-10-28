package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;

final class CarregarContribuicao {

    static final String ENTIDADE = "CONTRIBUICAO";

    private CarregarContribuicao() {
    }

    static Contribuicao ou404(ContribuicaoRepository repositorio, long id) {
        return repositorio.buscarPorId(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "CONTRIBUICAO_NAO_ENCONTRADA", "Contribuição não encontrada."));
    }

    static DoadoresPort.DoadorResumo doadorOu404(DoadoresPort doadores, long id) {
        return doadores.buscar(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("DOADOR_NAO_ENCONTRADO", "Doador não encontrado."));
    }
}
