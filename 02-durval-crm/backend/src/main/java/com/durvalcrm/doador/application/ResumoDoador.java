package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.StatusDoador;

/** Linha de resultado da busca e da checagem de duplicidade. */
public record ResumoDoador(long id, String nome, String telefonePrincipal, String emailPrincipal,
        StatusDoador status, long competenciasPendentes) {
}
