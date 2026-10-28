package com.durvalcrm.administracao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanilhaCsvTest {

    @Test
    void leComoOExcelSalva() {
        String csv = "﻿Data;Descrição;Valor\r\n01/09/2026;\"Luz; \"\"setembro\"\"\";1.234,56\r\n\r\n2/9/2026;Água;10\r\n";
        List<PlanilhaCsv.Linha> linhas = PlanilhaCsv.ler(csv, List.of("data", "descricao", "valor"));
        assertThat(linhas).hasSize(2);
        assertThat(linhas.get(0).numero()).isEqualTo(2);
        assertThat(linhas.get(0).valor("descricao")).isEqualTo("Luz; \"setembro\"");
        assertThat(linhas.get(1).numero()).isEqualTo(4);
        assertThat(ValoresPlanilha.data(linhas.get(1).valor("data"))).contains(LocalDate.of(2026, 9, 2));
        assertThat(ValoresPlanilha.valor(linhas.get(0).valor("valor"))).contains(new BigDecimal("1234.56"));
    }

    @Test
    void separadorVirgulaEColunasFaltando() {
        assertThat(PlanilhaCsv.ler("nome,e-mail\nAna,ana@x.com", List.of("nome", "email")).get(0).valor("email"))
                .isEqualTo("ana@x.com");
        assertThatThrownBy(() -> PlanilhaCsv.ler("nome;telefone\nAna;1", List.of("nome", "email")))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void valoresDaPlanilha() {
        assertThat(ValoresPlanilha.valor("R$ 50")).contains(new BigDecimal("50.00"));
        assertThat(ValoresPlanilha.valor("1,234")).isEmpty();
        assertThat(ValoresPlanilha.data("31/02/2026")).isEmpty();
        assertThat(ValoresPlanilha.meses("08/2026, 9/2026;08/2026"))
                .contains(List.of(YearMonth.of(2026, 8), YearMonth.of(2026, 9)));
        assertThat(ValoresPlanilha.meses("")).contains(List.of());
        assertThat(ValoresPlanilha.meses("agosto")).isEmpty();
    }
}
