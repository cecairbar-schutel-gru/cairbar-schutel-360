package com.durvalcrm.estoque.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * Ordem de saída das unidades (Spec §4, US-SALES-006): primeiro o estoque próprio, depois as
 * remessas consignadas da mais antiga para a mais nova (FIFO). Os lotes chegam já nessa ordem.
 */
public final class SaidaDeEstoque {

    private SaidaDeEstoque() {
    }

    public static int saldo(List<Lote> lotes) {
        return lotes.stream().mapToInt(Lote::quantidade).sum();
    }

    public static List<Retirada> retirar(List<Lote> lotesEmOrdem, int quantidade) {
        if (quantidade <= 0) {
            throw new IllegalArgumentException("A quantidade deve ser positiva.");
        }
        if (saldo(lotesEmOrdem) < quantidade) {
            throw new IllegalStateException("Saldo insuficiente.");
        }
        List<Retirada> retiradas = new ArrayList<>();
        int falta = quantidade;
        for (Lote lote : lotesEmOrdem) {
            if (falta == 0) {
                break;
            }
            int tirar = Math.min(falta, lote.quantidade());
            if (tirar > 0) {
                retiradas.add(new Retirada(lote.remessaId(), lote.remessaCodigo(), tirar));
                falta -= tirar;
            }
        }
        return retiradas;
    }
}
