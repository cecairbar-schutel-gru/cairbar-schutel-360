package com.durvalcrm.fechamento.domain;

import java.time.Instant;
import java.util.Objects;

/** Quem fez a ação e quando ({@code subject} é o {@code sub} do Keycloak). */
public record Autor(String subject, String nome, Instant em) {

    public Autor {
        Objects.requireNonNull(subject);
        Objects.requireNonNull(em);
    }

    public String exibicao() {
        return nome == null ? subject : nome;
    }
}
