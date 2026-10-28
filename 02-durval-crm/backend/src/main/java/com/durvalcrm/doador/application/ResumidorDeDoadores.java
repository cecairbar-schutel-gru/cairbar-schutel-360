package com.durvalcrm.doador.application;

import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.Email;
import com.durvalcrm.doador.domain.Telefone;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Monta {@link ResumoDoador} com a contagem de pendências obtida em lote no módulo Contribuições. */
class ResumidorDeDoadores {

    private final GerenciarCompetenciasDoDoadorUseCase competencias;

    ResumidorDeDoadores(GerenciarCompetenciasDoDoadorUseCase competencias) {
        this.competencias = competencias;
    }

    Map<Long, ResumoDoador> resumir(List<Doador> doadores) {
        Map<Long, Long> pendentes = competencias.contarPendentes(doadores.stream().map(Doador::getId).toList());
        return doadores.stream().collect(Collectors.toMap(Doador::getId,
                d -> new ResumoDoador(d.getId(), d.getNome(), d.telefonePrincipal().map(Telefone::numero).orElse(null),
                        d.emailPrincipal().map(Email::endereco).orElse(null), d.getStatus(),
                        pendentes.getOrDefault(d.getId(), 0L)),
                (a, b) -> a, LinkedHashMap::new));
    }
}
