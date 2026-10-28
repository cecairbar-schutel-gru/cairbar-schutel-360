package com.durvalcrm.doador.domain;

import com.durvalcrm.shared.domain.Textos;

/** CPF com 11 dígitos e dígitos verificadores válidos; armazenado só com dígitos. */
public record Cpf(String digitos) {

    public Cpf {
        if (!valido(digitos)) {
            throw new IllegalArgumentException("CPF inválido.");
        }
        digitos = Textos.apenasDigitos(digitos);
    }

    public static boolean valido(String valor) {
        String cpf = Textos.apenasDigitos(valor);
        if (cpf.length() != 11 || cpf.chars().distinct().count() == 1) {
            return false;
        }
        return digito(cpf, 9) == cpf.charAt(9) - '0' && digito(cpf, 10) == cpf.charAt(10) - '0';
    }

    private static int digito(String cpf, int tamanho) {
        int soma = 0;
        for (int i = 0; i < tamanho; i++) {
            soma += (cpf.charAt(i) - '0') * (tamanho + 1 - i);
        }
        int resto = (soma * 10) % 11;
        return resto == 10 ? 0 : resto;
    }
}
