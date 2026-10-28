package com.durvalcrm.doador.adapter.out.persistence;

import com.durvalcrm.doador.domain.ValorConsentimento;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.time.Instant;

@Embeddable
public class ConsentimentoEmbeddable {

    enum Canal { WHATSAPP, EMAIL }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ValorConsentimento valor;

    @Column(name = "registrado_em")
    private Instant registradoEm;

    @Column(name = "registrado_por")
    private String registradoPor;

    protected ConsentimentoEmbeddable() {
    }

    ConsentimentoEmbeddable(ValorConsentimento valor, Instant registradoEm, String registradoPor) {
        this.valor = valor;
        this.registradoEm = registradoEm;
        this.registradoPor = registradoPor;
    }

    ValorConsentimento getValor() { return valor; }
    Instant getRegistradoEm() { return registradoEm; }
    String getRegistradoPor() { return registradoPor; }
}
