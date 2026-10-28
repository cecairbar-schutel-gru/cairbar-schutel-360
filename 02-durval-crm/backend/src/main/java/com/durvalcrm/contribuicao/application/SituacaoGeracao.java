package com.durvalcrm.contribuicao.application;

import java.time.Instant;
import java.time.YearMonth;

/** Aviso dos painéis do Tesoureiro e do Administrador enquanto a geração do mês não tiver sucesso. */
public record SituacaoGeracao(YearMonth mes, Estado estado, int tentativas, Instant ultimaTentativa, String erro) {

    public enum Estado {
        CONCLUIDA,
        FALHA,
        AGUARDANDO
    }
}
