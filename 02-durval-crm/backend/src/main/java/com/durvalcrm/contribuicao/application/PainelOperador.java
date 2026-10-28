package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Resumo do dia e últimas contribuições recebidas pelo Operador (US-CONTRIB-021). */
public record PainelOperador(
        LocalDate data,
        int quantidade,
        BigDecimal totalDinheiro,
        BigDecimal totalPix,
        BigDecimal totalCartao,
        List<Ultima> ultimas) {

    public record Ultima(long id, Instant recebidaEm, String numeroRecibo, TipoContribuicao tipo, String doadorNome,
            BigDecimal total, StatusContribuicao status) {
    }
}
