package com.durvalcrm.venda.adapter.in.rest;

import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.venda.application.ConfirmarVendaCommand;
import com.durvalcrm.venda.domain.MeioPagamento;
import java.math.BigDecimal;
import java.util.List;

final class VendaRequests {

    private VendaRequests() {
    }

    record ItemRequest(Long produtoId, Integer quantidade, BigDecimal precoUnitario) {
    }

    record PagamentoRequest(MeioPagamento meio, BigDecimal valor, TipoCartao tipoCartao) {
    }

    record VendaRequest(List<ItemRequest> itens, List<PagamentoRequest> pagamentos, Long refazVendaId,
            String chaveIdempotencia) {

        ConfirmarVendaCommand paraComando() {
            return new ConfirmarVendaCommand(
                    itens == null ? List.of() : itens.stream()
                            .map(i -> new ConfirmarVendaCommand.Item(i.produtoId(), i.quantidade(), i.precoUnitario()))
                            .toList(),
                    pagamentos == null ? List.of() : pagamentos.stream()
                            .map(p -> new ConfirmarVendaCommand.Pagamento(p.meio(), p.valor(), p.tipoCartao()))
                            .toList(),
                    refazVendaId, chaveIdempotencia);
        }
    }

    record CancelamentoRequest(String motivo) {
    }
}
