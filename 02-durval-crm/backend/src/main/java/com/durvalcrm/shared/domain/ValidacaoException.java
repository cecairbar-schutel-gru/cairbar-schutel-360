package com.durvalcrm.shared.domain;

import java.util.List;

/** Dados de entrada inválidos, com o detalhe por campo. */
public class ValidacaoException extends ExcecaoDeDominio {

    private final List<ErroCampo> erros;

    public ValidacaoException(List<ErroCampo> erros) {
        super("VALIDACAO", "Dados inválidos.");
        this.erros = List.copyOf(erros);
    }

    public static ValidacaoException doCampo(String campo, String mensagem) {
        return new ValidacaoException(List.of(new ErroCampo(campo, mensagem)));
    }

    /** Lança a exceção se houver erros acumulados. */
    public static void lancarSeHouver(List<ErroCampo> erros) {
        if (!erros.isEmpty()) {
            throw new ValidacaoException(erros);
        }
    }

    public List<ErroCampo> getErros() {
        return erros;
    }
}
