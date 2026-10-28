package com.durvalcrm.contribuicao.application;

import java.time.Instant;
import java.time.YearMonth;

/** Última tentativa da geração mensal de um mês (US-CONTRIB-001). */
public record ExecucaoGeracao(YearMonth mes, Situacao situacao, int tentativas, Instant ultimaTentativa,
        int criadas, long duracaoMs, String erro) {

    public enum Situacao {
        SUCESSO,
        FALHA
    }
}
