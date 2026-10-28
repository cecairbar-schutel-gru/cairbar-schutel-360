package com.durvalcrm.financeiro.application;

/**
 * Intenções de gasto à espera da Tesouraria, para o painel do Tesoureiro (wireframe 3). Implementada
 * pelo módulo Intenções de gasto, para que o Financeiro não dependa dele.
 */
public interface IntencoesPendentesPort {

    long pendentes();
}
