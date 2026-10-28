package com.durvalcrm.administracao.domain;

import com.durvalcrm.financeiro.domain.TipoCategoria;
import java.util.Objects;

/**
 * Categoria (sem mãe) ou subcategoria do plano de contas (US-ADMIN-004). {@code emUso}: há
 * lançamento, intenção de gasto ou reclassificação com ela.
 */
public record CategoriaPlano(String codigo, String nome, TipoCategoria tipo, String categoriaPai, boolean sistema,
        boolean ativa, boolean emUso) {

    public CategoriaPlano {
        Objects.requireNonNull(codigo);
        Objects.requireNonNull(nome);
        Objects.requireNonNull(tipo);
    }

    public boolean subcategoria() {
        return categoriaPai != null;
    }

    public CategoriaPlano renomeada(String novoNome) {
        return new CategoriaPlano(codigo, novoNome, tipo, categoriaPai, sistema, ativa, emUso);
    }

    public CategoriaPlano comAtiva(boolean valor) {
        return new CategoriaPlano(codigo, nome, tipo, categoriaPai, sistema, valor, emUso);
    }
}
