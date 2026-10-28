package com.durvalcrm.contribuicao.domain;

import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Parte do valor recebido por um meio e uma conta; o nome da conta é guardado para o recibo.
 * No cartão, o tipo (crédito ou débito); nulo nos registros anteriores a 27/10/2026 e nos demais meios.
 */
public record Pagamento(MeioPagamento meio, long contaId, String contaNome, BigDecimal valor, TipoCartao tipoCartao) {

    public Pagamento {
        Objects.requireNonNull(meio);
        Objects.requireNonNull(contaNome);
        Objects.requireNonNull(valor);
    }

    public Pagamento(MeioPagamento meio, long contaId, String contaNome, BigDecimal valor) {
        this(meio, contaId, contaNome, valor, null);
    }
}
