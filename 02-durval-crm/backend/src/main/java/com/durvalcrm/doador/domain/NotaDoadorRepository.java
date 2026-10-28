package com.durvalcrm.doador.domain;

import java.util.List;

public interface NotaDoadorRepository {

    NotaDoador salvar(NotaDoador nota);

    /** Mais recentes primeiro. */
    List<NotaDoador> listarPorDoador(long doadorId);

    /** Apagamento definitivo na anonimização (US-DONOR-008). */
    void excluirPorDoador(long doadorId);
}
