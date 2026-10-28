package com.durvalcrm.shared.infrastructure;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Relógio único da aplicação: "hoje" e "mês atual" seguem o fuso da organização. Com
 * {@code durvalcrm.data-simulada} (AAAA-MM-DD, só para testes em DEV), o relógio anda deslocado em dias
 * inteiros para que a partida caia nessa data; a validação dos tokens continua no relógio real.
 */
@Configuration
public class RelogioConfiguration {

    private static final Logger LOG = LoggerFactory.getLogger(RelogioConfiguration.class);

    @Bean
    Clock relogio(@Value("${durvalcrm.fuso-horario:America/Sao_Paulo}") String fuso,
            @Value("${durvalcrm.data-simulada:}") String dataSimulada) {
        Clock sistema = Clock.system(ZoneId.of(fuso));
        if (dataSimulada.isBlank()) {
            return sistema;
        }
        long dias = ChronoUnit.DAYS.between(LocalDate.now(sistema), LocalDate.parse(dataSimulada.strip()));
        LOG.warn("Data simulada {}: relógio da aplicação deslocado em {} dia(s)", dataSimulada.strip(), dias);
        return Clock.offset(sistema, Duration.ofDays(dias));
    }
}
