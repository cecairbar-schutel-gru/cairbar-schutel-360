package com.durvalcrm.doador.adapter.out.persistence;

import com.durvalcrm.doador.domain.TipoTelefone;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/** Linha de {@code doador_contato}: telefone (só dígitos) ou e-mail, com o principal marcado. */
@Embeddable
public class ContatoEmbeddable {

    enum Tipo { TELEFONE, EMAIL }

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Tipo tipo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_telefone")
    private TipoTelefone tipoTelefone;

    @Column(nullable = false)
    private String valor;

    @Column(nullable = false)
    private boolean principal;

    protected ContatoEmbeddable() {
    }

    ContatoEmbeddable(Tipo tipo, TipoTelefone tipoTelefone, String valor, boolean principal) {
        this.tipo = tipo;
        this.tipoTelefone = tipoTelefone;
        this.valor = valor;
        this.principal = principal;
    }

    Tipo getTipo() { return tipo; }
    TipoTelefone getTipoTelefone() { return tipoTelefone; }
    String getValor() { return valor; }
    boolean isPrincipal() { return principal; }
}
