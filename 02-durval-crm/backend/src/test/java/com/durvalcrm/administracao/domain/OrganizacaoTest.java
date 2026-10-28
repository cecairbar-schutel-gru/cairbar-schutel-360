package com.durvalcrm.administracao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class OrganizacaoTest {

    static final Autor AUTOR = new Autor("sub", "Daniel", Instant.EPOCH);
    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0};

    @Test
    void normalizaEValida() {
        Organizacao o = Organizacao.validar(" Centro  Espírita ", "Cairbar", "11.222.333/0001-81", "",
                "(11) 3333-4444", "contato@cairbar.org", new Organizacao.Logo(PNG, "image/png"), "Obrigado!", null, null, null, AUTOR);
        assertThat(o.razaoSocial()).isEqualTo("Centro Espírita");
        assertThat(o.cnpj()).isEqualTo("11222333000181");
        assertThat(o.telefone()).isEqualTo("1133334444");
        assertThat(o.endereco()).isNull();
    }

    @Test
    void cnpjInvalidoELogoQueNaoEhImagemSaoRecusados() {
        assertThatThrownBy(() -> Organizacao.validar("R", "N", "11.222.333/0001-82", null, null, null, null, null,
                null, null, null, AUTOR)).isInstanceOf(ValidacaoException.class).hasMessage("Dados inválidos.");
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, "sem-arroba", null, null, null, null, null, AUTOR))
                .isInstanceOf(ValidacaoException.class);
        byte[] pdf = "%PDF-1.4".getBytes();
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null,
                new Organizacao.Logo(pdf, "image/png"), null, null, null, null, AUTOR)).isInstanceOf(ValidacaoException.class);
        byte[] grande = new byte[Organizacao.MAXIMO_LOGO + 1];
        System.arraycopy(PNG, 0, grande, 0, PNG.length);
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null,
                new Organizacao.Logo(grande, "image/png"), null, null, null, null, AUTOR)).isInstanceOf(ValidacaoException.class);
    }

    @Test
    void chavePixENormalizadaEExigeCidade() {
        Organizacao o = Organizacao.validar("R", "N", null, null, null, null, null, null, ChavePix.Tipo.TELEFONE,
                "(11) 98888-7777", " São  Paulo ", AUTOR);
        assertThat(o.pix()).isEqualTo(new ChavePix(ChavePix.Tipo.TELEFONE, "+5511988887777", "São Paulo"));
        assertThat(Organizacao.validar("R", "N", null, null, null, null, null, null, ChavePix.Tipo.CNPJ,
                "11.222.333/0001-81", "Campinas", AUTOR).pix().chave()).isEqualTo("11222333000181");
        assertThat(Organizacao.validar("R", "N", null, null, null, null, null, null, null, null, null, AUTOR).pix())
                .isNull();
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null, null, null,
                ChavePix.Tipo.CPF, "111.111.111-11", "Campinas", AUTOR)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null, null, null,
                ChavePix.Tipo.EMAIL, "pix@cairbar.org", "", AUTOR)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null, null, null, null,
                "pix@cairbar.org", null, AUTOR)).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Organizacao.validar("R", "N", null, null, null, null, null, null,
                ChavePix.Tipo.EMAIL, "pix@cairbar.org", "São José dos Campos", AUTOR))
                .isInstanceOf(ValidacaoException.class);
    }
}
