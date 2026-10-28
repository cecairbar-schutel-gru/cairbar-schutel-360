package com.durvalcrm.editora.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ObrigacaoTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");

    /** Exemplo da US-SALES-006: 3 × 50,00 × 40% = 60,00 e 1 × 50,00 × 35% = 17,50. */
    @Test
    void calculaPeloPrecoCobradoQuantidadeEPercentualDaRemessa() {
        assertThat(Obrigacao.calcular(3, new BigDecimal("50.00"), new BigDecimal("40"))).isEqualByComparingTo("60.00");
        assertThat(Obrigacao.calcular(1, new BigDecimal("50.00"), new BigDecimal("35"))).isEqualByComparingTo("17.50");
        assertThat(Obrigacao.calcular(1, new BigDecimal("9.99"), new BigDecimal("33.33"))).isEqualByComparingTo("3.33");
    }

    @Test
    void estornoDevolveOValorJaPagoComoCredito() {
        ItemRemessa item = new ItemRemessa(10, "R-0001", 3, 1, new BigDecimal("40"));
        Obrigacao nova = Obrigacao.porVenda(item, 7, 2, new BigDecimal("50.00"), AGORA);
        assertThat(nova.estornar(AGORA)).isEqualByComparingTo("0");
        assertThat(nova.getStatus()).isEqualTo(StatusObrigacao.ESTORNADA);

        Obrigacao paga = Obrigacao.reconstituir(1L, 3, 10, 1, OrigemObrigacao.VENDA, 7, 2, new BigDecimal("50.00"),
                new BigDecimal("40"), new BigDecimal("40.00"), new BigDecimal("25.00"),
                StatusObrigacao.PARCIALMENTE_PAGA, AGORA, null);
        assertThat(paga.estornar(AGORA)).isEqualByComparingTo("25.00");
    }
}
