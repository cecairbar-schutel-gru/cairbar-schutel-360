package com.durvalcrm.estoque.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ValidacaoException;
import org.junit.jupiter.api.Test;

class IsbnTest {

    @Test
    void aceitaIsbn13EIsbn10ComHifensEX() {
        assertThat(Isbn.deTexto("978-85-7328-786-8").valor()).isEqualTo("9788573287868");
        assertThat(Isbn.deTexto("0-8044-2957-x").valor()).isEqualTo("080442957X");
    }

    @Test
    void vazioEhNulo() {
        assertThat(Isbn.deTexto("  ")).isNull();
    }

    @Test
    void recusaDigitoVerificadorErrado() {
        assertThatThrownBy(() -> Isbn.deTexto("9788573287869")).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Isbn.deTexto("0804429571")).isInstanceOf(ValidacaoException.class);
        assertThatThrownBy(() -> Isbn.deTexto("12345")).isInstanceOf(ValidacaoException.class);
    }
}
