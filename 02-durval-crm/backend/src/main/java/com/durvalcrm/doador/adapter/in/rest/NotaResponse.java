package com.durvalcrm.doador.adapter.in.rest;

import com.durvalcrm.doador.domain.NotaDoador;
import java.time.Instant;

public record NotaResponse(long id, String texto, String autor, Instant criadaEm) {

    static NotaResponse de(NotaDoador n) {
        return new NotaResponse(n.id(), n.texto(), n.autorNome(), n.criadaEm());
    }
}
