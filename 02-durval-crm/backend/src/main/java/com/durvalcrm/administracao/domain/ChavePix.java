package com.durvalcrm.administracao.domain;

import com.durvalcrm.shared.domain.Cnpj;
import com.durvalcrm.shared.domain.Textos;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Chave PIX da organização, usada no QR Code de cobrança do PDV da cantina. A cidade é exigida pelo
 * padrão do Banco Central (BR Code) e vai sem acentos, em até 15 caracteres.
 */
public record ChavePix(Tipo tipo, String chave, String cidade) {

    public static final int MAXIMO_CIDADE = 15;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern ALEATORIA =
            Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");

    public enum Tipo {
        CPF, CNPJ, EMAIL, TELEFONE, ALEATORIA
    }

    /**
     * Normaliza a chave como o DICT a guarda (CPF/CNPJ só com dígitos, telefone em +55DDDNÚMERO,
     * e-mail e chave aleatória em minúsculas).
     *
     * @return a mensagem de erro, ou nulo se a chave for válida
     */
    static String erroChave(Tipo tipo, String chave) {
        if (chave.isEmpty()) {
            return "Informe a chave PIX.";
        }
        return switch (tipo) {
            case CPF -> cpfValido(chave) ? null : "CPF inválido.";
            case CNPJ -> Cnpj.valido(chave) ? null : "CNPJ inválido.";
            case EMAIL -> chave.length() <= 77 && EMAIL.matcher(chave).matches() ? null : "E-mail inválido.";
            case TELEFONE -> chave.matches("^\\+55\\d{10,11}$") ? null : "Telefone inválido. Informe DDD e 10 ou 11 dígitos.";
            case ALEATORIA -> ALEATORIA.matcher(chave).matches() ? null : "Chave aleatória inválida.";
        };
    }

    static String normalizarChave(Tipo tipo, String valor) {
        String v = Textos.compactar(valor);
        return switch (tipo) {
            case CPF, CNPJ -> Textos.apenasDigitos(v);
            case EMAIL, ALEATORIA -> v.toLowerCase(Locale.ROOT);
            case TELEFONE -> {
                String d = Textos.apenasDigitos(v);
                if (d.startsWith("55") && d.length() > 11) {
                    d = d.substring(2);
                }
                yield d.isEmpty() ? "" : "+55" + d;
            }
        };
    }

    private static boolean cpfValido(String cpf) {
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) {
            return false;
        }
        return digitoCpf(cpf, 9) == cpf.charAt(9) - '0' && digitoCpf(cpf, 10) == cpf.charAt(10) - '0';
    }

    private static int digitoCpf(String cpf, int tamanho) {
        int soma = 0;
        for (int i = 0; i < tamanho; i++) {
            soma += (cpf.charAt(i) - '0') * (tamanho + 1 - i);
        }
        int resto = (soma * 10) % 11;
        return resto == 10 ? 0 : resto;
    }
}
