package com.durvalcrm.estoque.domain;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;

/** Validação comum dos preços de venda. */
public final class Precos {

    private static final BigDecimal MAXIMO = new BigDecimal("99999999.99");

    private Precos() {
    }

    public static BigDecimal validar(String campo, BigDecimal preco) {
        if (preco == null || preco.signum() <= 0) {
            throw ValidacaoException.doCampo(campo, "Informe um preço maior que zero.");
        }
        if (preco.stripTrailingZeros().scale() > 2 || preco.compareTo(MAXIMO) > 0) {
            throw ValidacaoException.doCampo(campo, "Use no máximo duas casas decimais.");
        }
        return preco.setScale(2);
    }
}
