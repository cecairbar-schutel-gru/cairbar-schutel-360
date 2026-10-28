package com.durvalcrm.estoque.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ProdutoCatalogoTest {

    private static final Instant AGORA = Instant.parse("2026-10-19T13:00:00Z");

    @Test
    void cantinaComecaAtivaENomeCategoriaSaoObrigatorios() {
        ProdutoCatalogo p = ProdutoCatalogo.novoCantina("  Água   500ml ", "Bebidas", new BigDecimal("3.00"));
        assertThat(p.getNome()).isEqualTo("Água 500ml");
        assertThat(p.isAtivo()).isTrue();

        assertThatThrownBy(() -> ProdutoCatalogo.novoCantina("", "", new BigDecimal("3")))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros())
                        .extracting(c -> c.campo()).containsExactly("nome", "categoria"));
        assertThatThrownBy(() -> ProdutoCatalogo.novoCantina("Café", "Bebidas", BigDecimal.ZERO))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> ProdutoCatalogo.novoCantina("Café", "Bebidas", new BigDecimal("3.505")))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void livroConsignadoExigeEditoraEValidaRepasseEIsbn() {
        assertThatThrownBy(() -> ProdutoCatalogo.novoLivro(new DadosLivro("Nosso Lar", null, "123", null,
                new BigDecimal("140")), new BigDecimal("45")))
                .isInstanceOfSatisfying(ValidacaoException.class, e -> assertThat(e.getErros())
                        .extracting(c -> c.campo()).containsExactlyInAnyOrder("repassePadrao", "editoraId", "isbn"));

        ProdutoCatalogo livro = ProdutoCatalogo.novoLivro(new DadosLivro("Nosso Lar", "André Luiz", "978-85-7328-786-8",
                1L, new BigDecimal("35")), new BigDecimal("45"));
        assertThat(livro.getIsbn()).isEqualTo("9788573287868");
        assertThat(livro.getTipo()).isEqualTo(TipoProduto.LIVRO);
    }

    @Test
    void alterarPrecoDevolveHistoricoEExigeMotivoEValorDiferente() {
        ProdutoCatalogo p = ProdutoCatalogo.reconstituir(7L, TipoProduto.LIVRO, "O Caminho", null, null, null, null,
                new BigDecimal("50.00"), null, true);

        AlteracaoPreco a = p.alterarPreco(new BigDecimal("55"), "Reajuste da editora", null, "Daniel", AGORA);

        assertThat(a.precoAnterior()).isEqualByComparingTo("50.00");
        assertThat(a.precoNovo()).isEqualByComparingTo("55.00");
        assertThat(p.getPreco()).isEqualByComparingTo("55.00");
        assertThatThrownBy(() -> p.alterarPreco(new BigDecimal("55.00"), "x", null, "Daniel", AGORA))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> p.alterarPreco(new BigDecimal("60"), " ", null, "Daniel", AGORA))
                .isInstanceOf(ValidacaoException.class);
    }

    @Test
    void inativarEReativar() {
        ProdutoCatalogo p = ProdutoCatalogo.novoCantina("Suco", "Bebidas", new BigDecimal("6"));
        p.inativar();
        assertThatThrownBy(p::inativar).isInstanceOf(RegraDeNegocioException.class);
        p.reativar();
        assertThat(p.isAtivo()).isTrue();
    }

    @Test
    void livroNaoAceitaCorrecaoDeCantina() {
        ProdutoCatalogo livro = ProdutoCatalogo.reconstituir(1L, TipoProduto.LIVRO, "O Caminho", null, null, null, null,
                new BigDecimal("50"), null, true);
        assertThatThrownBy(() -> livro.corrigirCantina("x", "y")).isInstanceOf(RegraDeNegocioException.class);
    }
}
