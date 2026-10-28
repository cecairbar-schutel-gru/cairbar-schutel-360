package com.durvalcrm.doador.domain;

import com.durvalcrm.shared.domain.Textos;
import java.util.Objects;

/** Telefone brasileiro normalizado (somente dígitos, com DDD). */
public record Telefone(TipoTelefone tipo, String numero, boolean principal) {

    public Telefone {
        Objects.requireNonNull(tipo);
        numero = Textos.apenasDigitos(numero);
    }

    /** 10 ou 11 dígitos com DDD; celular (11 dígitos) começa com 9. */
    public static boolean valido(String valor) {
        String d = Textos.apenasDigitos(valor);
        if (d.length() != 10 && d.length() != 11) {
            return false;
        }
        if (d.charAt(0) == '0' || d.charAt(1) == '0') {
            return false;
        }
        return d.length() == 11 ? d.charAt(2) == '9' : d.charAt(2) >= '2' && d.charAt(2) <= '9';
    }

    Telefone comPrincipal(boolean valor) {
        return new Telefone(tipo, numero, valor);
    }
}
