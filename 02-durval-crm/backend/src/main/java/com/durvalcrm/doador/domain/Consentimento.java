package com.durvalcrm.doador.domain;

import java.time.Instant;
import java.util.Objects;

/** Consentimento de contato por canal, com a data e o autor do registro (LGPD). */
public record Consentimento(ValorConsentimento valor, Instant registradoEm, String registradoPor) {

    public Consentimento {
        Objects.requireNonNull(valor);
    }

    public static Consentimento naoInformado() {
        return new Consentimento(ValorConsentimento.NAO_INFORMADO, null, null);
    }

    public static Consentimento registrar(ValorConsentimento valor, String autor, Instant agora) {
        return valor == ValorConsentimento.NAO_INFORMADO ? naoInformado() : new Consentimento(valor, agora, autor);
    }

    public boolean permiteContato() {
        return valor == ValorConsentimento.SIM;
    }
}
