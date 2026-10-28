package com.durvalcrm.venda.domain;

import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.util.Objects;

/**
 * Parte do total recebida por um meio e uma conta; o nome da conta é guardado para o comprovante.
 * No cartão, o tipo (crédito ou débito); nulo nos registros anteriores a 27/10/2026 e nos demais meios.
 */
public record PagamentoVenda(MeioPagamento meio, long contaId, String contaNome, BigDecimal valor, TipoCartao tipoCartao) {

    public PagamentoVenda {
        Objects.requireNonNull(meio);
        Objects.requireNonNull(contaNome);
        Objects.requireNonNull(valor);
    }

    public PagamentoVenda(MeioPagamento meio, long contaId, String contaNome, BigDecimal valor) {
        this(meio, contaId, contaNome, valor, null);
    }
}
