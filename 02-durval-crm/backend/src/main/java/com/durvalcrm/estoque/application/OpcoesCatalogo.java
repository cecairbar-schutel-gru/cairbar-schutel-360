package com.durvalcrm.estoque.application;

import java.util.List;

/** Listas dos formulários de cadastro: editoras ativas e categorias da cantina. */
public record OpcoesCatalogo(List<EditoraOpcao> editoras, List<String> categorias) {

    public record EditoraOpcao(long id, String nome) {
    }
}
