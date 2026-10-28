package com.durvalcrm.intencaogasto.domain;

/** Como a despesa é paga (US-EXPENSE-004); cartão não é meio de pagamento de despesas. */
public enum MeioPagamentoGasto {
    /** Sai de um caixa. */
    DINHEIRO,
    /** Os demais saem de uma conta bancária. */
    PIX,
    TRANSFERENCIA,
    BOLETO;

    public boolean saiDoCaixa() {
        return this == DINHEIRO;
    }
}
