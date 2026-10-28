package com.durvalcrm.estoque.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class SaidaDeEstoqueTest {

    @Test
    void tiraPrimeiroDoProprioDepoisDasRemessasMaisAntigas() {
        List<Lote> lotes = List.of(new Lote(1, null, null, 1), new Lote(1, 10L, "R-0001", 3),
                new Lote(1, 11L, "R-0002", 5));

        assertThat(SaidaDeEstoque.retirar(lotes, 5)).containsExactly(new Retirada(null, null, 1),
                new Retirada(10L, "R-0001", 3), new Retirada(11L, "R-0002", 1));
    }

    @Test
    void pulaLotesZerados() {
        List<Lote> lotes = List.of(new Lote(1, null, null, 0), new Lote(1, 10L, "R-0001", 2));

        assertThat(SaidaDeEstoque.retirar(lotes, 2)).containsExactly(new Retirada(10L, "R-0001", 2));
    }

    @Test
    void recusaSaidaMaiorQueOSaldo() {
        assertThatThrownBy(() -> SaidaDeEstoque.retirar(List.of(new Lote(1, null, null, 2)), 3))
                .isInstanceOf(IllegalStateException.class);
    }
}
