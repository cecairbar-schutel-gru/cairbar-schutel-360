package com.durvalcrm.fechamento.application;

import java.time.Instant;

/**
 * Item 3 do checklist (US-INVENTORY-008, 012, 015): pedidos de baixa, preço ou inativação pendentes,
 * feitos antes do limite. Só o Administrador os resolve. Implementada pelo módulo Estoque.
 */
public interface SolicitacoesEstoquePendentesPort {

    long pendentesFeitasAntesDe(Instant limite);
}
