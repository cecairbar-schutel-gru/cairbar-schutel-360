package com.durvalcrm.intencaogasto.application;

import java.math.BigDecimal;
import java.util.List;

/**
 * Opções dos formulários: subcategorias de despesa disponíveis (US-EXPENSE-001), produtos ativos da
 * cantina e, para quem aprova, as contas de origem com o saldo atual (US-EXPENSE-004).
 */
public record OpcoesIntencao(List<CategoriaOpcao> categorias, List<ProdutoOpcao> produtos, List<ContaOpcao> contas) {

    /** Categoria-mãe ({@code categoriaPai} nulo) ou subcategoria disponível. */
    public record CategoriaOpcao(String codigo, String nome, String categoriaPai, String nomeCompleto,
            boolean compraCantina) {
    }

    public record ProdutoOpcao(long id, String nome, String categoria) {
    }

    /** {@code tipo}: CAIXA (dinheiro) ou BANCO (PIX, transferência ou boleto). */
    public record ContaOpcao(long id, String nome, String tipo, BigDecimal saldo) {
    }
}
