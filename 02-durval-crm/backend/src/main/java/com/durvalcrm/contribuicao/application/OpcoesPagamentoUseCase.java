package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase.Destinos;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import org.springframework.transaction.annotation.Transactional;

public class OpcoesPagamentoUseCase {

    private final ContasRecebimentoUseCase recebimento;

    public OpcoesPagamentoUseCase(ContasRecebimentoUseCase recebimento) {
        this.recebimento = recebimento;
    }

    @Transactional(readOnly = true)
    public OpcoesPagamento opcoes() {
        Destinos d = recebimento.destinos();
        return new OpcoesPagamento(d.dinheiro(), d.pix(), d.cartao());
    }

    /** Dinheiro no caixa, PIX na conta bancária e cartão em Cartão a receber, como definiu o Administrador. */
    ContaFinanceira contaDe(MeioPagamento meio) {
        return switch (meio) {
            case DINHEIRO -> recebimento.contaDoDinheiro();
            case PIX -> recebimento.contaDoPix();
            case CARTAO -> recebimento.contaDoCartao();
        };
    }
}
