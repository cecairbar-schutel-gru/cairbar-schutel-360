package com.durvalcrm.editora.adapter.in.financeiro;

import com.durvalcrm.editora.application.PagarEditoraUseCase;
import com.durvalcrm.financeiro.application.EstornoNaOrigemPort;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import org.springframework.stereotype.Component;

/** Estorno da despesa de um pagamento a editora no Financeiro: reabre as obrigações cobertas (US-PUBLISHER-008). */
@Component
class PagamentosParaFinanceiroAdapter implements EstornoNaOrigemPort {

    private final PagarEditoraUseCase pagamentos;

    PagamentosParaFinanceiroAdapter(PagarEditoraUseCase pagamentos) {
        this.pagamentos = pagamentos;
    }

    @Override
    public String origemTipo() {
        return OrigemLancamento.PAGAMENTO_EDITORA;
    }

    @Override
    public void lancamentoEstornado(long origemId) {
        pagamentos.aoEstornar(origemId);
    }
}
