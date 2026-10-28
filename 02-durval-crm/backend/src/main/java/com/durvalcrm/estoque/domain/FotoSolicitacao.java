package com.durvalcrm.estoque.domain;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.Objects;
import java.util.Set;

/** Foto opcional do pedido de baixa: JPG ou PNG de até 5 MB (US-INVENTORY-007). */
public record FotoSolicitacao(byte[] conteudo, String tipo) {

    public static final int MAXIMO_BYTES = 5 * 1024 * 1024;
    private static final Set<String> TIPOS = Set.of("image/jpeg", "image/png");

    public FotoSolicitacao {
        Objects.requireNonNull(conteudo);
        if (!TIPOS.contains(tipo)) {
            throw ValidacaoException.doCampo("foto", "A foto deve ser JPG ou PNG.");
        }
        if (conteudo.length == 0 || conteudo.length > MAXIMO_BYTES) {
            throw ValidacaoException.doCampo("foto", "A foto deve ter até 5 MB.");
        }
    }
}
