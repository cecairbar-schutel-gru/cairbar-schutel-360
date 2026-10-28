package com.durvalcrm.administracao.domain;

import java.time.Instant;
import java.util.Objects;

/** Quem fez e quando. */
public record Autor(String subject, String nome, Instant em) {

    public Autor {
        Objects.requireNonNull(subject);
        Objects.requireNonNull(em);
    }
}
