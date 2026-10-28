package com.durvalcrm.contribuicao.adapter.in.rest;

import com.durvalcrm.contribuicao.application.OpcoesPagamento;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import java.math.BigDecimal;

final class ContribuicaoResponses {

    private ContribuicaoResponses() {
    }

    record ContaResponse(long id, String nome) {
        static ContaResponse de(ContaFinanceira c) {
            return new ContaResponse(c.id(), c.nome());
        }
    }

    /** Conta que recebe cada forma de pagamento; {@code dinheiro} ou {@code pix} nulos se não definidos. */
    record OpcoesPagamentoResponse(ContaResponse dinheiro, ContaResponse pix, ContaResponse cartaoAReceber) {
        static OpcoesPagamentoResponse de(OpcoesPagamento o) {
            return new OpcoesPagamentoResponse(o.dinheiro() == null ? null : ContaResponse.de(o.dinheiro()),
                    o.pix() == null ? null : ContaResponse.de(o.pix()), ContaResponse.de(o.cartaoAReceber()));
        }
    }

    record ContribuicaoRegistradaResponse(long id, String numeroRecibo, TipoContribuicao tipo, BigDecimal total,
            StatusContribuicao status) {
        static ContribuicaoRegistradaResponse de(Contribuicao c) {
            return new ContribuicaoRegistradaResponse(c.getId(), c.getNumeroRecibo(), c.getTipo(), c.total(), c.getStatus());
        }
    }

    record IdResponse(long id) {
    }
}
