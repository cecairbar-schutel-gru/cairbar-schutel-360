package com.durvalcrm.contapagar.domain;

/** Como a conta a pagar se repete: uma vez, todo mês ou todo ano, no dia do primeiro vencimento. */
public enum Recorrencia {
    UNICA,
    MENSAL,
    ANUAL
}
