package com.durvalcrm.shared.domain;

import java.util.List;

/** Operação incompatível com o estado atual do agregado (ex.: reativar um doador ativo). */
public class RegraDeNegocioException extends ExcecaoDeDominio {

    private final List<ErroCampo> erros;

    public RegraDeNegocioException(String codigo, String mensagem) {
        this(codigo, mensagem, List.of());
    }

    /** Com o detalhe por campo ou item (ex.: os itens sem saldo numa venda). */
    public RegraDeNegocioException(String codigo, String mensagem, List<ErroCampo> erros) {
        super(codigo, mensagem);
        this.erros = List.copyOf(erros);
    }

    public List<ErroCampo> getErros() {
        return erros;
    }
}
