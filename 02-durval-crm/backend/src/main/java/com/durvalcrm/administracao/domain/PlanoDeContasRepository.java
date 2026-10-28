package com.durvalcrm.administracao.domain;

import java.util.List;
import java.util.Optional;

public interface PlanoDeContasRepository {

    /** Categorias e subcategorias, ativas e inativas. */
    List<CategoriaPlano> listar();

    Optional<CategoriaPlano> buscar(String codigo);

    void inserir(CategoriaPlano categoria);

    void atualizar(CategoriaPlano categoria);

    void excluir(String codigo);
}
