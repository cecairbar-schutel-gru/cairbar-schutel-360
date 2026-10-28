package com.durvalcrm.intencaogasto.domain;

import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Orçamento ou comprovante: PDF, JPG ou PNG de até 10 MB, no máximo 5 por intenção (US-EXPENSE-001). */
public record AnexoIntencao(String nome, String tipo, byte[] conteudo) {

    public static final int MAXIMO_BYTES = 10 * 1024 * 1024;
    public static final int MAXIMO_POR_INTENCAO = 5;
    private static final Set<String> TIPOS = Set.of("application/pdf", "image/jpeg", "image/png");

    public AnexoIntencao {
        Objects.requireNonNull(conteudo);
        nome = Textos.compactar(nome).isEmpty() ? "anexo" : Textos.compactar(nome);
        if (nome.length() > 200) {
            nome = nome.substring(nome.length() - 200);
        }
        if (!TIPOS.contains(tipo)) {
            throw ValidacaoException.doCampo("anexos", nome + ": o anexo deve ser PDF, JPG ou PNG.");
        }
        if (conteudo.length == 0 || conteudo.length > MAXIMO_BYTES) {
            throw ValidacaoException.doCampo("anexos", nome + ": cada anexo deve ter até 10 MB.");
        }
    }

    public static void exigirQuantidade(List<AnexoIntencao> anexos) {
        if (anexos.size() > MAXIMO_POR_INTENCAO) {
            throw ValidacaoException.doCampo("anexos", "Anexe no máximo 5 arquivos.");
        }
    }
}
