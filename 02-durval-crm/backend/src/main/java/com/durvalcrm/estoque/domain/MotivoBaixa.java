package com.durvalcrm.estoque.domain;

/** Motivos de baixa (Spec §4); a de consignado por dano ou extravio gera obrigação com a editora. */
public enum MotivoBaixa {
    VENCIMENTO,
    DANO,
    EXTRAVIO;

    public boolean geraObrigacaoConsignado() {
        return this == DANO || this == EXTRAVIO;
    }
}
