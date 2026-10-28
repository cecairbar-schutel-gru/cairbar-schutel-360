package com.durvalcrm.financeiro.application;

import java.util.List;

/** Lançamento gravado e avisos que não bloqueiam (ex.: conta bancária negativa). */
public record ResultadoLancamento(long id, List<String> avisos) {

    public ResultadoLancamento {
        avisos = List.copyOf(avisos);
    }
}
