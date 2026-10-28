package com.durvalcrm.contapagar.adapter.in.financeiro;

import com.durvalcrm.contapagar.application.ContasPagarUseCase;
import com.durvalcrm.financeiro.application.EstornoNaOrigemPort;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import org.springframework.stereotype.Component;

/** Estorno da despesa de uma conta a pagar no Financeiro: o vencimento volta a ficar em aberto. */
@Component
class ContasPagarParaFinanceiroAdapter implements EstornoNaOrigemPort {

    private final ContasPagarUseCase contas;

    ContasPagarParaFinanceiroAdapter(ContasPagarUseCase contas) {
        this.contas = contas;
    }

    @Override
    public String origemTipo() {
        return OrigemLancamento.CONTA_PAGAR;
    }

    @Override
    public void lancamentoEstornado(long origemId) {
        contas.aoEstornar(origemId);
    }
}
