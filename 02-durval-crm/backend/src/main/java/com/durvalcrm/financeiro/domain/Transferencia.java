package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Transferência interna (US-FINANCIAL-003): caixa ↔ banco e banco ↔ banco, nunca Cartão a receber
 * (que só sai pela liquidação). Duas linhas de conta que somam zero e nenhuma categoria: não é
 * receita nem despesa.
 */
public final class Transferencia {

    private Transferencia() {
    }

    public static List<LinhaConta> linhas(ContaFinanceira origem, ContaFinanceira destino, BigDecimal valor) {
        List<ErroCampo> erros = new ArrayList<>();
        Valores.exigirPositivo(valor, "valor", erros);
        if (origem.id() == destino.id()) {
            erros.add(new ErroCampo("contaDestinoId", "Escolha uma conta de destino diferente da origem."));
        }
        ValidacaoException.lancarSeHouver(erros);
        if (origem.tipo() == TipoConta.CARTAO_A_RECEBER || destino.tipo() == TipoConta.CARTAO_A_RECEBER) {
            throw new RegraDeNegocioException("TRANSFERENCIA_CARTAO",
                    "Cartão a receber não entra em transferências: ele só sai pela liquidação de cartão.");
        }
        return List.of(new LinhaConta(origem.id(), valor.negate()), new LinhaConta(destino.id(), valor));
    }
}
