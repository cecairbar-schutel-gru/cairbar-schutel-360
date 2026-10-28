package com.durvalcrm.doador.application;

import java.util.List;

/** Aniversariantes do período e quantos doadores ativos não têm data de nascimento. */
public record ResultadoAniversariantes(List<Aniversariante> itens, long semDataNascimento) {
}
