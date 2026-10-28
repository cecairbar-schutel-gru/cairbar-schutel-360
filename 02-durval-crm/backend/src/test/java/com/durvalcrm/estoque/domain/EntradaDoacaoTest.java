package com.durvalcrm.estoque.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class EntradaDoacaoTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");

    @Test
    void validaItensEObservacao() {
        assertThatThrownBy(() -> EntradaDoacao.nova(List.of(), null, "s", "n", AGORA))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> EntradaDoacao.nova(List.of(new ItemEntrada(1, 0)), null, "s", "n", AGORA))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> EntradaDoacao.nova(List.of(new ItemEntrada(1, 1), new ItemEntrada(1, 2)), null, "s",
                "n", AGORA)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> EntradaDoacao.nova(List.of(new ItemEntrada(1, 1)), "x".repeat(201), "s", "n", AGORA))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void cancelaUmaVezComMotivo() {
        EntradaDoacao e = EntradaDoacao.nova(List.of(new ItemEntrada(1, 3)), " Doação da Dona Maria ", "s", "n", AGORA);
        assertThat(e.getObservacao()).isEqualTo("Doação da Dona Maria");
        assertThatThrownBy(() -> e.cancelar(" ", "Daniel", AGORA)).isInstanceOf(ValidacaoException.class);
        e.cancelar("Lançada em duplicidade", "Daniel", AGORA);
        assertThat(e.cancelada()).isTrue();
        assertThatThrownBy(() -> e.cancelar("de novo", "Daniel", AGORA)).isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void estornoInverteOMovimentoEApontaOOriginal() {
        MovimentoEstoque m = new MovimentoEstoque(5L, 1, null, TipoMovimento.ENTRADA_DOACAO, 3, AGORA, "s", "n",
                "ENTRADA_DOACAO", 9L, null);
        MovimentoEstoque estorno = m.estorno(AGORA, "a", "Daniel");
        assertThat(estorno.tipo()).isEqualTo(TipoMovimento.ESTORNO);
        assertThat(estorno.quantidade()).isEqualTo(-3);
        assertThat(estorno.estornaMovimentoId()).isEqualTo(5L);
        assertThatThrownBy(() -> estorno.estorno(AGORA, "a", "n")).isInstanceOf(IllegalStateException.class);
    }
}
