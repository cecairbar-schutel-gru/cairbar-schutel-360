package com.durvalcrm.shared.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class ConfiguracaoAutenticacaoControllerTest {

    @Test
    void separaUrlERealmDoIssuer() {
        var configuracao = ConfiguracaoAutenticacaoController.deIssuer(
                "https://comunidade-cairbar.203-0-113-10.nip.io/realms/cecairbar/", "durvalcrm-web", "durvalcrm-api");

        assertThat(configuracao.url()).isEqualTo("https://comunidade-cairbar.203-0-113-10.nip.io");
        assertThat(configuracao.realm()).isEqualTo("cecairbar");
        assertThat(configuracao.clientId()).isEqualTo("durvalcrm-web");
        assertThat(configuracao.clientIdApi()).isEqualTo("durvalcrm-api");
    }

    @Test
    void recusaIssuerSemRealm() {
        assertThatThrownBy(() -> ConfiguracaoAutenticacaoController.deIssuer("https://kc.exemplo.org/", "w", "a"))
                .isInstanceOf(IllegalStateException.class);
    }
}
