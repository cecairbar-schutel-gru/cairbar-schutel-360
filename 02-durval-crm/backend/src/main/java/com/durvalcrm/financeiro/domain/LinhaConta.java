package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Movimento de uma conta dentro de um lançamento; positivo entra, negativo sai. Em Cartão a receber,
 * a linha pode guardar o tipo de cartão (crédito ou débito) para dividir o saldo a receber.
 */
public record LinhaConta(long contaId, BigDecimal valor, TipoCartao tipoCartao) {

    public LinhaConta {
        Objects.requireNonNull(valor);
    }

    public LinhaConta(long contaId, BigDecimal valor) {
        this(contaId, valor, null);
    }
}
