package com.durvalcrm.financeiro.domain;

import java.util.Set;

/** Códigos das subcategorias do plano de contas inicial (Spec §5) usadas pelos lançamentos automáticos. */
public final class CategoriaFinanceira {

    public static final String MENSALIDADES = "RECEITAS_CONTRIBUICOES.MENSALIDADES";
    public static final String DOACOES_EXTRAORDINARIAS = "RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS";
    public static final String DOACOES_ANONIMAS = "RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS";
    public static final String VENDAS_LIVROS = "RECEITAS_VENDAS.LIVROS";
    public static final String VENDAS_CANTINA = "RECEITAS_VENDAS.CANTINA";
    public static final String COMPRA_CANTINA = "DESPESAS_COMERCIAIS.COMPRA_CANTINA";
    public static final String REPASSE_EDITORAS = "DESPESAS_COMERCIAIS.REPASSE_EDITORAS";
    public static final String TAXAS_CARTAO = "DESPESAS_COMERCIAIS.TAXAS_CARTAO";

    /**
     * Categorias com fluxo próprio, que não aparecem no lançamento manual (US-FINANCIAL-009):
     * Mensalidades, Doações, Receitas de vendas, Repasse às editoras, Taxas de cartão e Compra de
     * produtos da cantina.
     */
    public static final Set<String> FLUXO_PROPRIO = Set.of(MENSALIDADES, DOACOES_EXTRAORDINARIAS, DOACOES_ANONIMAS,
            VENDAS_LIVROS, VENDAS_CANTINA, COMPRA_CANTINA, REPASSE_EDITORAS, TAXAS_CARTAO);

    /** Categorias-mãe com fluxo próprio: nenhuma subcategoria delas entra no lançamento manual. */
    public static final Set<String> CATEGORIAS_FLUXO_PROPRIO = Set.of("RECEITAS_VENDAS");

    private CategoriaFinanceira() {
    }

    public static boolean temFluxoProprio(Categoria c) {
        return FLUXO_PROPRIO.contains(c.codigo()) || CATEGORIAS_FLUXO_PROPRIO.contains(c.categoriaPai());
    }
}
