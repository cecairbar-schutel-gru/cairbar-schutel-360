package com.durvalcrm.estoque.application;

/** Produto de nome parecido, para o aviso de duplicidade do cadastro (US-INVENTORY-002). */
public record ProdutoSimilar(long id, String nome, String categoria, boolean ativo) {
}
