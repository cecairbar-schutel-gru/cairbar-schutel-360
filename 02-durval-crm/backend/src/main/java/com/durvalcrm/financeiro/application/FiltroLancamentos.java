package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Filtros da lista de lançamentos (US-FINANCIAL-005). {@code categoria} aceita a categoria (todas as
 * suas subcategorias) ou a subcategoria; {@code valor} procura o valor absoluto em qualquer linha.
 */
public record FiltroLancamentos(Long contaId, LocalDate de, LocalDate ate, NaturezaLancamento natureza,
        String categoria, String origem, String texto, BigDecimal valor) {
}
