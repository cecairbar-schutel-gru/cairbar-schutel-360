package com.durvalcrm.estoque.domain;

import java.util.List;
import java.util.Optional;

public interface CatalogoRepository {

    Optional<ProdutoCatalogo> obter(long id);

    /** Livros da editora, ativos e inativos (remessas do módulo Editoras). */
    List<ProdutoCatalogo> livrosDaEditora(long editoraId);

    /** Insere (sem id) ou atualiza o cadastro, devolvendo-o com id. */
    ProdutoCatalogo salvar(ProdutoCatalogo produto);

    boolean isbnEmUso(String isbn, Long excetoId);

    /** Só para produtos sem histórico (ver {@link EstoqueRepository#possuiHistorico}). */
    void excluir(long id);

    void registrarPreco(AlteracaoPreco alteracao);

    /** Do mais recente para o mais antigo. */
    List<AlteracaoPreco> historicoPrecos(long produtoId);
}
