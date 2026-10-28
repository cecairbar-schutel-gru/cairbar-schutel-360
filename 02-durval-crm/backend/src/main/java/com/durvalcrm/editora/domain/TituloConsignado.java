package com.durvalcrm.editora.domain;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * Livro do catálogo do Estoque (US-INVENTORY-001) visto pelo módulo Editoras: o percentual padrão é
 * copiado para cada nova remessa.
 */
public record TituloConsignado(long produtoId, String nome, String autor, String isbn, Long editoraId,
        BigDecimal repassePadrao, boolean ativo) {

    public TituloConsignado {
        Objects.requireNonNull(nome);
    }
}
