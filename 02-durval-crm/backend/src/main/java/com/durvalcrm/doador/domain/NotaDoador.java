package com.durvalcrm.doador.domain;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;

/** Nota em texto livre (US-DONOR-012). Imutável: correções são feitas com uma nova nota. */
public record NotaDoador(Long id, long doadorId, String texto, String autorSubject, String autorNome,
        Instant criadaEm) {

    public static final int LIMITE = 500;

    public static NotaDoador criar(Doador doador, String texto, String autorSubject, String autorNome, Instant agora) {
        doador.exigirNaoAnonimizado("DOADOR_ANONIMIZADO", "Doador anonimizado não aceita notas.");
        String limpo = texto == null ? "" : texto.trim();
        if (limpo.isEmpty() || limpo.length() > LIMITE) {
            throw ValidacaoException.doCampo("texto", "A nota deve ter de 1 a " + LIMITE + " caracteres.");
        }
        return new NotaDoador(null, doador.getId(), limpo, autorSubject, autorNome, agora);
    }
}
