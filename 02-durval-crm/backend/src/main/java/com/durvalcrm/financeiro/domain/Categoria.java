package com.durvalcrm.financeiro.domain;

import java.util.Objects;

/**
 * Categoria ou subcategoria do plano de contas (Spec §5): um único nível de subcategoria. O código
 * da subcategoria é "CATEGORIA.SUBCATEGORIA"; os lançamentos usam sempre a subcategoria.
 */
public record Categoria(String codigo, String nome, TipoCategoria tipo, String categoriaPai, String nomePai,
        boolean ativa) {

    public Categoria {
        Objects.requireNonNull(codigo);
        Objects.requireNonNull(nome);
        Objects.requireNonNull(tipo);
    }

    public boolean subcategoria() {
        return categoriaPai != null;
    }

    /** "Despesas comerciais › Taxas de cartão". */
    public String nomeCompleto() {
        return nomePai == null ? nome : nomePai + " › " + nome;
    }
}
