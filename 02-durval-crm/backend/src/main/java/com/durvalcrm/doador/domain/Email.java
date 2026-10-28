package com.durvalcrm.doador.domain;

import java.util.regex.Pattern;

public record Email(String endereco, boolean principal) {

    private static final Pattern FORMATO = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$");

    public Email {
        endereco = endereco == null ? "" : endereco.trim();
    }

    public static boolean valido(String valor) {
        return valor != null && FORMATO.matcher(valor.trim()).matches();
    }

    Email comPrincipal(boolean valor) {
        return new Email(endereco, valor);
    }
}
