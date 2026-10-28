package com.durvalcrm.estoque.domain;

import java.util.Collection;
import java.util.List;

public interface ProdutoRepository {

    /**
     * Produtos ativos cujo nome, título ou autor contém o termo normalizado (ou cujo ISBN é igual),
     * do tipo informado (todos se nulo), ordenados pelo nome.
     */
    List<Produto> buscarAtivos(String termoNormalizado, String isbn, TipoProduto tipo, int limite);

    /** Ativos ou não, na ordem dos ids informados que existirem. */
    List<Produto> buscarPorIds(Collection<Long> ids);
}
