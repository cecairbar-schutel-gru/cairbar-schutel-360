package com.durvalcrm.fechamento.adapter.out.financeiro;

import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.SituacaoPeriodo;
import com.durvalcrm.financeiro.application.SituacaoFechamentoPort;
import org.springframework.stereotype.Component;

/** Entrega ao painel do Tesoureiro o resumo do checklist do fechamento (US-CLOSING-001). */
@Component
class SituacaoFechamentoParaFinanceiroAdapter implements SituacaoFechamentoPort {

    private final ChecklistFechamentoUseCase checklist;

    SituacaoFechamentoParaFinanceiroAdapter(ChecklistFechamentoUseCase checklist) {
        this.checklist = checklist;
    }

    @Override
    public SituacaoPeriodo situacao() {
        return checklist.resumo();
    }
}
