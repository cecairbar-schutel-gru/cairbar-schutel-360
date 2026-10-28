package com.durvalcrm.shared.domain;

/** Base das exceções de regra de negócio; o código é estável e lido pelo frontend. */
public abstract class ExcecaoDeDominio extends RuntimeException {

    private final String codigo;

    protected ExcecaoDeDominio(String codigo, String mensagem) {
        super(mensagem);
        this.codigo = codigo;
    }

    public String getCodigo() {
        return codigo;
    }
}
