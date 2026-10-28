package com.durvalcrm.shared.adapter.in.rest;

import java.time.Clock;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * "Hoje" no relógio da aplicação (público): o SPA alinha a ele as datas padrão e as validações da tela,
 * inclusive com a data simulada de DEV ({@code durvalcrm.data-simulada}).
 */
@RestController
@RequestMapping("/api/publico")
class RelogioController {

    private final Clock relogio;

    RelogioController(Clock relogio) {
        this.relogio = relogio;
    }

    @GetMapping("/relogio")
    Relogio relogio() {
        return new Relogio(LocalDate.now(relogio));
    }

    record Relogio(LocalDate hoje) {
    }
}
