package com.durvalcrm.shared.adapter.in.rest;

import com.durvalcrm.shared.domain.ErroCampo;
import java.util.List;

/** Corpo padrão de erro da API: {@code {codigo, mensagem, erros}}. */
public record RespostaErro(String codigo, String mensagem, List<ErroCampo> erros) {

    public static RespostaErro acessoNegado() {
        return new RespostaErro("ACESSO_NEGADO", "Você não tem permissão para esta operação.", List.of());
    }
}
