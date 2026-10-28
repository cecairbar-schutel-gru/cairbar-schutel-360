package com.durvalcrm.shared.domain;

/** Erro de validação associado a um campo do formulário. */
public record ErroCampo(String campo, String mensagem) {
}
