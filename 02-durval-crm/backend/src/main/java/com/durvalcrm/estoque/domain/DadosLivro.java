package com.durvalcrm.estoque.domain;

import java.math.BigDecimal;

/** Campos editáveis de um título (US-INVENTORY-001); o preço muda só pelo histórico de preços. */
public record DadosLivro(String titulo, String autor, String isbn, Long editoraId, BigDecimal repassePadrao) {
}
