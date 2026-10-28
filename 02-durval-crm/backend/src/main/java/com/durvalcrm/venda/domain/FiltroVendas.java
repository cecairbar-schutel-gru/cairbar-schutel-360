package com.durvalcrm.venda.domain;

import java.time.LocalDate;

/**
 * {@code vendedorSubject} nulo: vendas de todos. Período inclusivo pela data financeira. {@code pdv}
 * nulo: as do PDV da cantina e as demais.
 */
public record FiltroVendas(LocalDate de, LocalDate ate, String vendedorSubject, StatusVenda status, Boolean pdv,
        Long numero, int limite) {
}
