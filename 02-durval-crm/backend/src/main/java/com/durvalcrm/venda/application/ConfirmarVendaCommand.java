package com.durvalcrm.venda.application;

import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.venda.domain.MeioPagamento;
import java.math.BigDecimal;
import java.util.List;

/**
 * Confirmação de uma venda. O preço informado é o que o Vendedor viu no carrinho: se mudou, nada
 * é gravado. Não se informa conta: cada meio entra na conta de recebimento definida pelo Administrador.
 */
public record ConfirmarVendaCommand(List<Item> itens, List<Pagamento> pagamentos, Long refazVendaId,
        String chaveIdempotencia) {

    public ConfirmarVendaCommand {
        itens = itens == null ? List.of() : List.copyOf(itens);
        pagamentos = pagamentos == null ? List.of() : List.copyOf(pagamentos);
    }

    public record Item(Long produtoId, Integer quantidade, BigDecimal precoUnitario) {
    }

    public record Pagamento(MeioPagamento meio, BigDecimal valor, TipoCartao tipoCartao) {
    }
}
