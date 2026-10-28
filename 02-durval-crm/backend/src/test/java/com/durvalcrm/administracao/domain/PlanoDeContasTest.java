package com.durvalcrm.administracao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanoDeContasTest {

    static final PlanoDeContas PLANO = new PlanoDeContas(List.of(
            new CategoriaPlano("DESPESAS_COMERCIAIS", "Despesas comerciais", TipoCategoria.DESPESA, null, false, true, false),
            new CategoriaPlano("DESPESAS_COMERCIAIS.TAXAS_CARTAO", "Taxas de cartão", TipoCategoria.DESPESA,
                    "DESPESAS_COMERCIAIS", true, true, true),
            new CategoriaPlano("OUTRAS_DESPESAS", "Outras despesas", TipoCategoria.DESPESA, null, false, true, false),
            new CategoriaPlano("OUTRAS_DESPESAS.EVENTOS", "Despesas com eventos", TipoCategoria.DESPESA,
                    "OUTRAS_DESPESAS", false, true, true),
            new CategoriaPlano("OUTRAS_DESPESAS.BRINDES", "Brindes", TipoCategoria.DESPESA, "OUTRAS_DESPESAS", false,
                    true, false)));

    @Test
    void subcategoriaHerdaOTipoETemCodigoDaMae() {
        CategoriaPlano nova = PLANO.nova("  Material   gráfico ", null, "OUTRAS_DESPESAS");
        assertThat(nova.codigo()).isEqualTo("OUTRAS_DESPESAS.MATERIAL_GRAFICO");
        assertThat(nova.nome()).isEqualTo("Material gráfico");
        assertThat(nova.tipo()).isEqualTo(TipoCategoria.DESPESA);
        assertThat(PLANO.nova("Bazar", TipoCategoria.RECEITA, null).codigo()).isEqualTo("BAZAR");
    }

    @Test
    void nomesUnicosDentroDaMaeEDoisNiveis() {
        assertThatThrownBy(() -> PLANO.nova("despesas COM eventos", null, "OUTRAS_DESPESAS"))
                .isInstanceOf(ValidacaoException.class);
        // Mesmo nome em outra categoria é permitido.
        assertThat(PLANO.nova("Despesas com eventos", null, "DESPESAS_COMERCIAIS").categoriaPai())
                .isEqualTo("DESPESAS_COMERCIAIS");
        assertThatThrownBy(() -> PLANO.nova("Outro nível", null, "OUTRAS_DESPESAS.EVENTOS"))
                .isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> PLANO.nova("Sem tipo", null, null)).isInstanceOf(ValidacaoException.class);
    }

    @Test
    void sistemaSoSeRenomeia() {
        assertThat(PLANO.renomear("DESPESAS_COMERCIAIS.TAXAS_CARTAO", "Tarifas de cartão").nome())
                .isEqualTo("Tarifas de cartão");
        assertThatThrownBy(() -> PLANO.inativar("DESPESAS_COMERCIAIS.TAXAS_CARTAO"))
                .isInstanceOf(RegraDeNegocioException.class).hasMessageContaining("automáticos");
        assertThatThrownBy(() -> PLANO.inativar("DESPESAS_COMERCIAIS")).isInstanceOf(RegraDeNegocioException.class);
    }

    @Test
    void usadaSoSeInativaEInativarAMaeInativaAsSubcategorias() {
        assertThatThrownBy(() -> PLANO.exigirExcluivel("OUTRAS_DESPESAS.EVENTOS"))
                .isInstanceOf(RegraDeNegocioException.class).hasMessageContaining("só pode ser inativada");
        assertThatThrownBy(() -> PLANO.exigirExcluivel("OUTRAS_DESPESAS")).isInstanceOf(RegraDeNegocioException.class);
        assertThat(PLANO.exigirExcluivel("OUTRAS_DESPESAS.BRINDES").nome()).isEqualTo("Brindes");
        List<CategoriaPlano> inativadas = PLANO.inativar("OUTRAS_DESPESAS");
        assertThat(inativadas).extracting(CategoriaPlano::codigo)
                .containsExactly("OUTRAS_DESPESAS", "OUTRAS_DESPESAS.EVENTOS", "OUTRAS_DESPESAS.BRINDES");
        assertThat(inativadas).noneMatch(CategoriaPlano::ativa);
    }

    @Test
    void subcategoriaSoVoltaComAMaeAtiva() {
        PlanoDeContas plano = new PlanoDeContas(List.of(
                new CategoriaPlano("X", "X", TipoCategoria.RECEITA, null, false, false, false),
                new CategoriaPlano("X.Y", "Y", TipoCategoria.RECEITA, "X", false, false, false)));
        assertThatThrownBy(() -> plano.reativar("X.Y")).isInstanceOf(RegraDeNegocioException.class);
        assertThat(plano.reativar("X").ativa()).isTrue();
    }
}
