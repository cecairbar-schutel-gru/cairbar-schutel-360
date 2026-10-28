package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.MovimentoEstoque;

public record MovimentoComRemessa(MovimentoEstoque movimento, String remessaCodigo) {
}
