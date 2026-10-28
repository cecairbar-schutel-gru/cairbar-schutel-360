package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;

final class CarregarDoador {

    private CarregarDoador() {
    }

    static Doador ou404(DoadorRepository repositorio, long id) {
        return repositorio.buscarPorId(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("DOADOR_NAO_ENCONTRADO", "Doador não encontrado."));
    }
}
