package com.durvalcrm.contribuicao.adapter.in.rest;

import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

public record CompetenciaResponse(YearMonth competencia, BigDecimal valor, StatusCompetencia status,
        LocalDate dataPagamento, String numeroRecibo) {

    static CompetenciaResponse de(Competencia c) {
        return new CompetenciaResponse(c.getMes(), c.getValor(), c.getStatus(), c.getDataPagamento(), c.getNumeroRecibo());
    }
}
