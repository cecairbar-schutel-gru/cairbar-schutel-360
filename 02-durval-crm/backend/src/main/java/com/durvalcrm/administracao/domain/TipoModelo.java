package com.durvalcrm.administracao.domain;

import java.util.List;

/**
 * Modelos de mensagem (US-ADMIN-003) e as variáveis que cada um aceita: o aniversário não tem valor,
 * competências nem recibo.
 */
public enum TipoModelo {
    AGRADECIMENTO(List.of("nome", "valor", "competencias", "data", "recibo", "organizacao")),
    ANIVERSARIO(List.of("nome", "data", "organizacao"));

    private final List<String> variaveis;

    TipoModelo(List<String> variaveis) {
        this.variaveis = variaveis;
    }

    public List<String> variaveis() {
        return variaveis;
    }
}
