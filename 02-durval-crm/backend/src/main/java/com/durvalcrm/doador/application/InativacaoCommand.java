package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.DecisaoPendencias;

public record InativacaoCommand(String motivo, DecisaoPendencias pendencias) {
}
