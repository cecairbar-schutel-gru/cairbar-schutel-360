package com.durvalcrm.financeiro.domain;

/**
 * Conta que recebe cada forma de pagamento das vendas e contribuições, definida pelo Administrador:
 * dinheiro numa conta do tipo caixa e PIX numa conta bancária; cartão vai sempre para Cartão a
 * receber. Quem vende ou recebe não escolhe conta. Nulo: a forma ainda não tem conta definida.
 */
public record ContasRecebimento(Long dinheiroContaId, Long pixContaId) {

    public static final ContasRecebimento NENHUMA = new ContasRecebimento(null, null);

    public boolean recebe(long contaId) {
        return Long.valueOf(contaId).equals(dinheiroContaId) || Long.valueOf(contaId).equals(pixContaId);
    }
}
