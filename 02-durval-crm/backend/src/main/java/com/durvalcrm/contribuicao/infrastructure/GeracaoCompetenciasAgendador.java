package com.durvalcrm.contribuicao.infrastructure;

import com.durvalcrm.contribuicao.application.GerarCompetenciasMensaisUseCase;
import java.time.Clock;
import java.time.YearMonth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * US-CONTRIB-001: roda no dia 1 às 00:05 (fuso da organização) e, enquanto o mês não tiver uma
 * execução bem-sucedida, tenta de novo a cada 15 minutos (cobre falhas e o servidor fora do ar no
 * horário). A idempotência fica no caso de uso.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "durvalcrm.competencias.agendamento.habilitado", havingValue = "true",
        matchIfMissing = true)
class GeracaoCompetenciasAgendador {

    private static final Logger LOG = LoggerFactory.getLogger(GeracaoCompetenciasAgendador.class);

    private final GerarCompetenciasMensaisUseCase geracao;
    private final Clock relogio;

    GeracaoCompetenciasAgendador(GerarCompetenciasMensaisUseCase geracao, Clock relogio) {
        this.geracao = geracao;
        this.relogio = relogio;
    }

    @Scheduled(cron = "0 5 0 1 * *", zone = "${durvalcrm.fuso-horario}")
    void noHorario() {
        executarSeNecessario();
    }

    @Scheduled(fixedDelayString = "PT15M", initialDelayString = "PT1M")
    void novaTentativa() {
        executarSeNecessario();
    }

    synchronized void executarSeNecessario() {
        YearMonth mes = YearMonth.now(relogio);
        if (!geracao.pendente(mes)) {
            return;
        }
        try {
            int criadas = geracao.gerar(mes);
            LOG.info("Competências de {} geradas: {}", mes, criadas);
        } catch (RuntimeException e) {
            LOG.error("Falha na geração das competências de {}", mes, e);
            geracao.registrarFalha(mes, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }
}
