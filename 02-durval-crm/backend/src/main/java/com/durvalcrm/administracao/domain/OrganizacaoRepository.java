package com.durvalcrm.administracao.domain;

import java.util.Optional;

public interface OrganizacaoRepository {

    /** Vazio enquanto valem os dados da instalação. */
    Optional<Organizacao> buscar();

    void salvar(Organizacao organizacao);
}
