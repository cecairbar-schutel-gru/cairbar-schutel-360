package com.durvalcrm.venda.application;

import com.durvalcrm.venda.domain.MeioPagamento;
import com.durvalcrm.venda.domain.StatusVenda;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Linha da lista de vendas (US-SALES-011); {@code pdv}: feita pelo perfil PDV da cantina. */
public record ResumoVenda(long id, long numero, Instant confirmadaEm, String vendedorNome, BigDecimal total, List<MeioPagamento> meios, StatusVenda status,
        boolean pdv) {
}
