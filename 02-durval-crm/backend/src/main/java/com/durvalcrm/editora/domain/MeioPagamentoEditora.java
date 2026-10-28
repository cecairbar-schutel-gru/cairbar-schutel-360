package com.durvalcrm.editora.domain;

/** Como a editora é paga (US-PUBLISHER-008). */
public enum MeioPagamentoEditora {
    PIX,
    TRANSFERENCIA,
    /** Sai de um caixa; os demais, de uma conta bancária. */
    DINHEIRO;

    public boolean saiDoCaixa() {
        return this == DINHEIRO;
    }
}
