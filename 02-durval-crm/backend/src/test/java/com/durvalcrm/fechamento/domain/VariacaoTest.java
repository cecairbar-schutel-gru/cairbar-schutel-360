package com.durvalcrm.fechamento.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VariacaoTest {

    private static Variacao v(String atual, String anterior) {
        return Variacao.de(atual == null ? null : new BigDecimal(atual), anterior == null ? null : new BigDecimal(anterior));
    }

    @Test
    void destacaVariacaoAcimaDe20PorCentoEDeCemReais() {
        Variacao alta = v("1300.00", "1000.00");
        assertThat(alta.diferenca()).isEqualByComparingTo("300.00");
        assertThat(alta.percentual()).isEqualByComparingTo("30.0");
        assertThat(alta.destaque()).isTrue();
        // 50% mas só R$ 50,00: sem destaque.
        assertThat(v("150.00", "100.00").destaque()).isFalse();
        // R$ 150,00 mas só 15%: sem destaque.
        assertThat(v("1150.00", "1000.00").destaque()).isFalse();
        assertThat(v("700.00", "1000.00").percentual()).isEqualByComparingTo("-30.0");
        assertThat(v("700.00", "1000.00").destaque()).isTrue();
    }

    @Test
    void semValorNoMesAnteriorNaoTemPercentual() {
        Variacao nova = v("250.00", null);
        assertThat(nova.anterior()).isEqualByComparingTo("0");
        assertThat(nova.percentual()).isNull();
        assertThat(nova.destaque()).isTrue();
        assertThat(v("80.00", "0").destaque()).isFalse();
        assertThat(v(null, "300.00").percentual()).isEqualByComparingTo("-100.0");
    }
}
