package com.durvalcrm.intencaogasto.domain;

import java.time.Instant;
import java.util.Objects;

/** Quem age sobre a intenção ({@code sub} do token e nome para exibição) e quando. */
public record Autor(String subject, String nome, Instant em) {

    public Autor {
        Objects.requireNonNull(subject);
        Objects.requireNonNull(em);
    }
}
