package com.durvalcrm.venda.application;

import com.durvalcrm.estoque.domain.TipoProduto;
import java.math.BigDecimal;
import java.util.List;

/** Itens da venda cancelada com o preço e o saldo de agora (US-SALES-010). */
public record VendaParaRefazer(long vendaId, long numero, List<Item> itens) {

    public record Item(long produtoId, String produtoNome, TipoProduto tipo, int quantidade, BigDecimal precoAnterior,
            BigDecimal precoAtual, int disponivel, boolean ativo) {
    }
}
