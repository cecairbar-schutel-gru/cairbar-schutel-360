package com.durvalcrm.contribuicao.application;

import com.durvalcrm.financeiro.domain.ContaFinanceira;

/**
 * Conta que recebe cada forma de pagamento (US-CONTRIB-004), definida pelo Administrador; quem recebe
 * só a vê. {@code dinheiro} ou {@code pix} nulos: a forma ainda não pode ser usada.
 */
public record OpcoesPagamento(ContaFinanceira dinheiro, ContaFinanceira pix, ContaFinanceira cartaoAReceber) {
}
