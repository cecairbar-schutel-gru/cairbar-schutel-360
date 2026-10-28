package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;

final class CarregarProduto {

    static final String ENTIDADE = "PRODUTO";

    private CarregarProduto() {
    }

    static ProdutoCatalogo ou404(CatalogoRepository catalogo, long id) {
        return catalogo.obter(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("PRODUTO_NAO_ENCONTRADO", "Produto não encontrado."));
    }
}
