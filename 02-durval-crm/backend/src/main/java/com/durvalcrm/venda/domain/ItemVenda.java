package com.durvalcrm.venda.domain;

import com.durvalcrm.estoque.domain.TipoProduto;
import java.math.BigDecimal;
import java.util.Objects;

/** Linha da venda com o preço vigente na confirmação, guardado e nunca recalculado (Spec §4). */
public record ItemVenda(long produtoId, String produtoNome, TipoProduto tipo, int quantidade, BigDecimal precoUnitario) {

    public ItemVenda {
        Objects.requireNonNull(produtoNome);
        Objects.requireNonNull(tipo);
        Objects.requireNonNull(precoUnitario);
    }

    public BigDecimal subtotal() {
        return precoUnitario.multiply(BigDecimal.valueOf(quantidade));
    }
}
