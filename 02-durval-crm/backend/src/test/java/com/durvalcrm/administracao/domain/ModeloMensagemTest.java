package com.durvalcrm.administracao.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.durvalcrm.shared.domain.ValidacaoException;
import org.junit.jupiter.api.Test;

class ModeloMensagemTest {

    @Test
    void variavelDesconhecidaEhApontadaAntesDeSalvar() {
        assertThat(ModeloMensagem.variaveisDesconhecidas(TipoModelo.AGRADECIMENTO,
                "Olá, {nome}! Recibo {recibo} de {doador} em {data}.")).containsExactly("{doador}");
        // O aniversário não tem valor nem recibo.
        assertThat(ModeloMensagem.variaveisDesconhecidas(TipoModelo.ANIVERSARIO, "{nome} {valor}"))
                .containsExactly("{valor}");
        assertThatThrownBy(() -> ModeloMensagem.validar(TipoModelo.AGRADECIMENTO, "Olá, {doador}", "Assunto", "Corpo"))
                .isInstanceOf(ValidacaoException.class)
                .satisfies(e -> assertThat(((ValidacaoException) e).getErros()).singleElement()
                        .satisfies(c -> assertThat(c.campo()).isEqualTo("whatsapp")));
        ModeloMensagem.validar(TipoModelo.ANIVERSARIO, "Feliz aniversário, {nome}!", "{nome}", "{organizacao}");
    }
}
