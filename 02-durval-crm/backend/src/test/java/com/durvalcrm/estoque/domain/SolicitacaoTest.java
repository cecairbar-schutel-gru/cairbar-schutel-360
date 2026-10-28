package com.durvalcrm.estoque.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SolicitacaoTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");

    private static Solicitacao baixa() {
        return Solicitacao.baixa(1L, null, 2, MotivoBaixa.VENCIMENTO, "Venceram ontem", null, "sub-bruno", "Bruno",
                AGORA);
    }

    @Test
    void baixaExigeQuantidadeMotivoEJustificativa() {
        assertThatThrownBy(() -> Solicitacao.baixa(1L, null, 0, null, " ", null, "s", "n", AGORA))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros())
                        .extracting(c -> c.campo()).containsExactly("quantidade", "motivo", "justificativa"));
        assertThat(baixa().getStatus()).isEqualTo(StatusSolicitacao.PENDENTE);
    }

    @Test
    void pedidoDePrecoExigePrecoPositivoEDiferente() {
        assertThatThrownBy(() -> Solicitacao.preco(1L, new BigDecimal("3.50"), new BigDecimal("3.5"), "custo", "s",
                "n", AGORA)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Solicitacao.preco(1L, new BigDecimal("3.50"), new BigDecimal("-1"), "custo", "s",
                "n", AGORA)).isInstanceOf(ValidacaoException.class);
        assertThat(Solicitacao.preco(1L, new BigDecimal("3.50"), new BigDecimal("4"), "custo", "s", "n", AGORA)
                .getNovoPreco()).isEqualByComparingTo("4.00");
    }

    @Test
    void soQuemPediuCancelaEnquantoPendente() {
        Solicitacao s = baixa();
        assertThatThrownBy(() -> s.cancelar("sub-outro", AGORA)).isInstanceOf(RegraDeNegocioException.class);
        s.cancelar("sub-bruno", AGORA);
        assertThat(s.getStatus()).isEqualTo(StatusSolicitacao.CANCELADA);
        assertThatThrownBy(() -> s.aprovar("sub-admin", "Daniel", AGORA))
                .isInstanceOfSatisfying(RegraDeNegocioException.class,
                        e -> assertThat(e.getMessage()).isEqualTo("Esta solicitação já foi cancelada."));
    }

    @Test
    void rejeicaoExigeMotivoEAutoAprovacaoEhMarcada() {
        Solicitacao s = baixa();
        assertThatThrownBy(() -> s.rejeitar("sub-admin", "Daniel", "", AGORA)).isInstanceOf(ValidacaoException.class);

        Solicitacao propria = baixa();
        propria.aprovar("sub-bruno", "Bruno", AGORA);
        assertThat(propria.autoAprovada()).isTrue();
    }
}
