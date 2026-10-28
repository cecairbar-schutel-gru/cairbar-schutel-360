package com.durvalcrm.financeiro.domain;

import java.util.List;
import java.util.Optional;

public interface CategoriaRepository {

    Optional<Categoria> buscar(String codigo);

    /** Categorias e subcategorias, ativas e inativas, ordenadas por tipo e nome. */
    List<Categoria> listar();
}
