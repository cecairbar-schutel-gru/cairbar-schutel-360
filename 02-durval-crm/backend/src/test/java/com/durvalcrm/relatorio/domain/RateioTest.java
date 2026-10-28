package com.durvalcrm.relatorio.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RateioTest {

    @Test
    void divideProporcionalmenteSemPerderCentavos() {
        Map<String, Long> pesos = new LinkedHashMap<>();
        pesos.put("a", 1L);
        pesos.put("b", 1L);
        pesos.put("c", 1L);
        Map<String, Long> partes = Rateio.proporcional(100, pesos);
        assertThat(partes.values().stream().mapToLong(Long::longValue).sum()).isEqualTo(100);
        assertThat(partes.values()).containsExactlyInAnyOrder(34L, 33L, 33L);
    }

    @Test
    void funcionaComValoresNegativos() {
        Map<String, Long> pesos = new LinkedHashMap<>();
        pesos.put("caixa", -7000L);
        pesos.put("banco", -3000L);
        assertThat(Rateio.proporcional(-1001, pesos)).containsEntry("caixa", -701L).containsEntry("banco", -300L);
    }

    @Test
    void semPesosNinguemRecebe() {
        assertThat(Rateio.proporcional(500, Map.of("a", 0L))).containsEntry("a", 0L);
    }
}
