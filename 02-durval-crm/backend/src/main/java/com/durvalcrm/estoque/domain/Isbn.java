package com.durvalcrm.estoque.domain;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.Locale;

/** ISBN-10 ou ISBN-13 com dígito verificador válido, guardado sem hífens nem espaços. */
public record Isbn(String valor) {

    public Isbn {
        if (!valido(valor)) {
            throw ValidacaoException.doCampo("isbn", "ISBN inválido: confira os 10 ou 13 dígitos.");
        }
    }

    /** Nulo quando o texto está vazio (o ISBN é opcional). */
    public static Isbn deTexto(String texto) {
        String compacto = compactar(texto);
        return compacto.isEmpty() ? null : new Isbn(compacto);
    }

    public static String compactar(String texto) {
        return texto == null ? "" : texto.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    static boolean valido(String v) {
        if (v == null) {
            return false;
        }
        if (v.matches("\\d{13}")) {
            int soma = 0;
            for (int i = 0; i < 12; i++) {
                soma += (v.charAt(i) - '0') * (i % 2 == 0 ? 1 : 3);
            }
            return (10 - soma % 10) % 10 == v.charAt(12) - '0';
        }
        if (v.matches("\\d{9}[\\dX]")) {
            int soma = 0;
            for (int i = 0; i < 10; i++) {
                int digito = v.charAt(i) == 'X' ? 10 : v.charAt(i) - '0';
                soma += digito * (10 - i);
            }
            return soma % 11 == 0;
        }
        return false;
    }
}
