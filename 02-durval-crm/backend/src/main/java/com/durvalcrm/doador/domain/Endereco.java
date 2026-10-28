package com.durvalcrm.doador.domain;

import com.durvalcrm.shared.domain.Textos;
import java.util.stream.Stream;

/** Endereço opcional; o CEP é guardado só com dígitos. */
public record Endereco(String cep, String logradouro, String numero, String complemento, String bairro,
        String cidade, String uf) {

    public Endereco {
        cep = Textos.apenasDigitos(cep);
        logradouro = limpar(logradouro);
        numero = limpar(numero);
        complemento = limpar(complemento);
        bairro = limpar(bairro);
        cidade = limpar(cidade);
        uf = limpar(uf).toUpperCase();
    }

    public static boolean cepValido(String valor) {
        return Textos.apenasDigitos(valor).length() == 8;
    }

    public boolean vazio() {
        return Stream.of(cep, logradouro, numero, complemento, bairro, cidade, uf).allMatch(String::isEmpty);
    }

    private static String limpar(String valor) {
        return valor == null ? "" : valor.trim();
    }
}
