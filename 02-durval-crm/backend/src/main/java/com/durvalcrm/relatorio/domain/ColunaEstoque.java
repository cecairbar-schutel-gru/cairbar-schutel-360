package com.durvalcrm.relatorio.domain;

/**
 * Coluna do relatório de estoque (US-REPORT-007) em que cada tipo de movimento cai. Entradas e
 * ajustes somam a quantidade com o sinal; saídas são mostradas positivas. Cancelamento de venda
 * reduz as vendas e o estorno de um movimento reduz a coluna do movimento estornado, de modo que
 * inicial + entradas − saídas + ajustes = final.
 */
public enum ColunaEstoque {
    COMPRA(false),
    DOACAO(false),
    REMESSA(false),
    VENDA(true),
    DEVOLUCAO(true),
    BAIXA(true),
    AJUSTE(false);

    private final boolean saida;

    ColunaEstoque(boolean saida) {
        this.saida = saida;
    }

    public boolean saida() {
        return saida;
    }

    /** Quantidade como aparece na coluna, a partir da gravada no movimento. */
    public int naColuna(int quantidade) {
        return saida ? -quantidade : quantidade;
    }

    /**
     * @param tipo         tipo do movimento (nomes de {@code estoque.domain.TipoMovimento})
     * @param tipoEstornado no ESTORNO, o tipo do movimento que ele reverte
     */
    public static ColunaEstoque de(String tipo, String tipoEstornado) {
        if ("ESTORNO".equals(tipo)) {
            return tipoEstornado == null || "ESTORNO".equals(tipoEstornado) ? AJUSTE : de(tipoEstornado, null);
        }
        return switch (tipo) {
            case "ENTRADA_COMPRA" -> COMPRA;
            case "ENTRADA_DOACAO" -> DOACAO;
            case "ENTRADA_REMESSA" -> REMESSA;
            case "VENDA", "CANCELAMENTO_VENDA" -> VENDA;
            case "DEVOLUCAO_EDITORA" -> DEVOLUCAO;
            case "BAIXA_VENCIMENTO", "BAIXA_DANO", "BAIXA_EXTRAVIO" -> BAIXA;
            default -> AJUSTE;
        };
    }

    /** Motivo da baixa (VENCIMENTO, DANO, EXTRAVIO) ou nulo, considerando o estorno de uma baixa. */
    public static String motivoBaixa(String tipo, String tipoEstornado) {
        String t = "ESTORNO".equals(tipo) ? tipoEstornado : tipo;
        return t != null && t.startsWith("BAIXA_") ? t.substring("BAIXA_".length()) : null;
    }
}
