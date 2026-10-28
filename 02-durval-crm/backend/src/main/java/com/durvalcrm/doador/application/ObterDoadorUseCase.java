package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import org.springframework.transaction.annotation.Transactional;

public class ObterDoadorUseCase {

    private final DoadorRepository repositorio;

    public ObterDoadorUseCase(DoadorRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public Doador obter(long id) {
        return CarregarDoador.ou404(repositorio, id);
    }
}
