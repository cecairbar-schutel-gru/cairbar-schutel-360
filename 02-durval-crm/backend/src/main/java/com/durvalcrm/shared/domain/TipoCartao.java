package com.durvalcrm.shared.domain;

import java.util.Optional;

/**
 * Crédito ou débito no pagamento em cartão. Os dois entram na mesma conta (Cartão a receber); o tipo
 * aparece no comprovante, no relatório de vendas e na liquidação. Registros anteriores ficam sem tipo.
 */
public enum TipoCartao {
    CREDITO,
    DEBITO;

    /** "crédito" ou "débito". */
    public String rotulo() {
        return this == CREDITO ? "crédito" : "débito";
    }

    /** "Cartão de crédito", "Cartão de débito" ou só "Cartão" quando o tipo não foi informado. */
    public static String meio(TipoCartao tipo) {
        return tipo == null ? "Cartão" : "Cartão de " + tipo.rotulo();
    }

    /** Em nova operação, o tipo é obrigatório no cartão e não cabe nos demais meios. */
    public static Optional<ErroCampo> conferir(boolean cartao, TipoCartao tipo) {
        if (cartao && tipo == null) {
            return Optional.of(new ErroCampo("tipoCartao", "Informe se o cartão é de crédito ou de débito."));
        }
        if (!cartao && tipo != null) {
            return Optional.of(new ErroCampo("tipoCartao", "Crédito ou débito só se informa no pagamento em cartão."));
        }
        return Optional.empty();
    }
}
