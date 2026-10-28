package com.durvalcrm.financeiro.domain;

import java.util.Set;

/** Módulo que gerou o lançamento ({@code origem_tipo}). */
public final class OrigemLancamento {

    public static final String CONTRIBUICAO = "CONTRIBUICAO";
    public static final String VENDA = "VENDA";
    public static final String INTENCAO_GASTO = "INTENCAO_GASTO";
    public static final String PAGAMENTO_EDITORA = "PAGAMENTO_EDITORA";
    public static final String CONTA_PAGAR = "CONTA_PAGAR";
    public static final String MANUAL = "MANUAL";
    public static final String TRANSFERENCIA = "TRANSFERENCIA";
    public static final String LIQUIDACAO_CARTAO = "LIQUIDACAO_CARTAO";
    /**
     * Histórico importado (US-ADMIN-012): datado antes da data de corte da conta, já contido no saldo
     * inicial; aparece nos relatórios do passado e não muda os saldos a partir do corte.
     */
    public static final String IMPORTACAO = "IMPORTACAO";

    /**
     * Origens corrigidas por estorno no Financeiro (US-FINANCIAL-010). Contribuições e vendas são
     * corrigidas pelo próprio cancelamento (US-CONTRIB-011, US-SALES-009).
     */
    public static final Set<String> ESTORNAVEIS_NO_FINANCEIRO = Set.of(MANUAL, TRANSFERENCIA, LIQUIDACAO_CARTAO,
            INTENCAO_GASTO, PAGAMENTO_EDITORA, CONTA_PAGAR);

    private OrigemLancamento() {
    }
}
