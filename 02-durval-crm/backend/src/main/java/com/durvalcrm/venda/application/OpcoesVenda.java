package com.durvalcrm.venda.application;

import com.durvalcrm.financeiro.domain.ContaFinanceira;

/**
 * Contas que recebem cada forma de pagamento (US-SALES-005), definidas pelo Administrador; o
 * Vendedor só as vê. {@code dinheiro} ou {@code pix} nulos: a forma ainda não pode ser usada.
 */
public record OpcoesVenda(ContaFinanceira dinheiro, ContaFinanceira pix, ContaFinanceira cartaoAReceber) {
}
