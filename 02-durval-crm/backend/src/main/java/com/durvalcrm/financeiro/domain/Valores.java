package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import java.math.BigDecimal;
import java.util.List;

final class Valores {

    private Valores() {
    }

    static void exigirPositivo(BigDecimal valor, String campo, List<ErroCampo> erros) {
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo(campo, "Informe um valor maior que zero."));
        } else if (valor.scale() > 2) {
            erros.add(new ErroCampo(campo, "Use no máximo duas casas decimais."));
        }
    }
}
