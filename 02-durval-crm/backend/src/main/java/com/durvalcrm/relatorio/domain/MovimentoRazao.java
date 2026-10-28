package com.durvalcrm.relatorio.domain;

import java.time.LocalDate;
import java.util.Map;

/**
 * Lançamento do razão como o fluxo de caixa o vê: data financeira, linhas de conta (por conta) e
 * linhas de categoria (por subcategoria), em centavos e com o sinal gravado. Estornos chegam como
 * lançamentos próprios, com os valores invertidos, na data em que foram lançados.
 */
public record MovimentoRazao(long lancamentoId, LocalDate data, Map<Long, Long> contas, Map<String, Long> categorias) {

    public MovimentoRazao {
        contas = Map.copyOf(contas);
        categorias = Map.copyOf(categorias);
    }
}
