package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.Objects;
import java.util.Set;

/** Comprovante opcional do lançamento manual: PDF, JPG ou PNG de até 5 MB (US-FINANCIAL-009). */
public record AnexoLancamento(String nome, String tipo, byte[] conteudo) {

    public static final int MAXIMO_BYTES = 5 * 1024 * 1024;
    private static final Set<String> TIPOS = Set.of("application/pdf", "image/jpeg", "image/png");

    public AnexoLancamento {
        Objects.requireNonNull(conteudo);
        nome = Textos.compactar(nome).isEmpty() ? "anexo" : Textos.compactar(nome);
        if (nome.length() > 200) {
            nome = nome.substring(nome.length() - 200);
        }
        if (!TIPOS.contains(tipo)) {
            throw ValidacaoException.doCampo("anexo", "O anexo deve ser PDF, JPG ou PNG.");
        }
        if (conteudo.length == 0 || conteudo.length > MAXIMO_BYTES) {
            throw ValidacaoException.doCampo("anexo", "O anexo deve ter até 5 MB.");
        }
    }
}
