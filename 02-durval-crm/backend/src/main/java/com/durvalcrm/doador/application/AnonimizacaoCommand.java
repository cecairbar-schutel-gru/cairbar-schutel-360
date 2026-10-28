package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.DecisaoPendencias;

/** @param pendencias obrigatório quando o doador ainda está ativo */
public record AnonimizacaoCommand(String motivo, String nomeConfirmacao, DecisaoPendencias pendencias) {
}
