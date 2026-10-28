package com.durvalcrm.editora.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.Cnpj;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import org.junit.jupiter.api.Test;

class EditoraTest {

    @Test
    void validaCnpjPelosDigitosVerificadores() {
        assertThat(Cnpj.valido("11.222.333/0001-81")).isTrue();
        assertThat(Cnpj.valido("11.222.333/0001-82")).isFalse();
        assertThat(Cnpj.valido("11111111111111")).isFalse();
        assertThat(Cnpj.formatar("11222333000181")).isEqualTo("11.222.333/0001-81");
    }

    @Test
    void cadastroNormalizaEValidaOsCampos() {
        Editora e = Editora.nova(new Editora.Dados("  Editora   Luz ", "11.222.333/0001-81", "", "(11) 3333-4444",
                "Contato@Luz.com.br", new Editora.DadosPagamento("Banco do Brasil", "1234", "5678-9", null), null));
        assertThat(e.nome()).isEqualTo("Editora Luz");
        assertThat(e.cnpj()).isEqualTo("11222333000181");
        assertThat(e.telefone()).isEqualTo("1133334444");
        assertThat(e.email()).isEqualTo("contato@luz.com.br");
        assertThat(e.contatoNome()).isNull();
        assertThat(e.ativa()).isTrue();

        assertThatThrownBy(() -> Editora.nova(new Editora.Dados("", "", null, "123", "x@", null, null)))
                .isInstanceOfSatisfying(ValidacaoException.class, ex -> assertThat(ex.getErros())
                        .extracting(ErroCampo::campo).containsExactly("nome", "cnpj", "telefone", "email"));
    }
}
