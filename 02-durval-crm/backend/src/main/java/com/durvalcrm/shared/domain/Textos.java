package com.durvalcrm.shared.domain;

import java.text.Normalizer;
import java.util.Locale;

/** Normalização de texto usada em buscas e comparações. */
public final class Textos {

    private Textos() {
    }

    /** Minúsculas, sem acentos e com espaços normalizados ("João  da Silva" → "joao da silva"). */
    public static String normalizar(String valor) {
        if (valor == null) {
            return "";
        }
        String semAcentos = Normalizer.normalize(valor, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcentos.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    /** Remove espaços extras mantendo a grafia original. */
    public static String compactar(String valor) {
        return valor == null ? "" : valor.trim().replaceAll("\\s+", " ");
    }

    public static String apenasDigitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }

    public static boolean vazio(String valor) {
        return valor == null || valor.isBlank();
    }
}
