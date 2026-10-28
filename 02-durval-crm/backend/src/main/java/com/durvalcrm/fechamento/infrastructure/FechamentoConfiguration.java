package com.durvalcrm.fechamento.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase;
import com.durvalcrm.fechamento.application.CompetenciasDoMesPort;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase;
import com.durvalcrm.fechamento.application.IntencoesEmAbertoPort;
import com.durvalcrm.fechamento.application.JanelaFechamentoUseCase;
import com.durvalcrm.fechamento.application.SnapshotsPort;
import com.durvalcrm.fechamento.application.SolicitacoesEstoquePendentesPort;
import com.durvalcrm.fechamento.domain.JanelaFechamentoRepository;
import com.durvalcrm.fechamento.domain.PeriodoRepository;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FechamentoConfiguration {

    @Bean
    JanelaFechamentoUseCase janelaFechamentoUseCase(JanelaFechamentoRepository repositorio,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new JanelaFechamentoUseCase(repositorio, auditoria, usuario, relogio);
    }

    @Bean
    ChecklistFechamentoUseCase checklistFechamentoUseCase(PeriodoRepository periodos,
            DemonstrativoFinanceiroUseCase financeiro, ConsultarConciliacoesUseCase conciliacoes,
            IntencoesEmAbertoPort intencoes, SolicitacoesEstoquePendentesPort solicitacoes,
            SaldosEditorasUseCase editoras, JanelaFechamentoUseCase janela, Clock relogio) {
        return new ChecklistFechamentoUseCase(periodos, financeiro, conciliacoes, intencoes, solicitacoes, editoras,
                janela, relogio);
    }

    @Bean
    DemonstrativoMensalUseCase demonstrativoMensalUseCase(PeriodoRepository periodos, SnapshotsPort snapshots,
            DemonstrativoFinanceiroUseCase financeiro, SaldosEditorasUseCase editoras,
            CompetenciasDoMesPort competencias, Clock relogio) {
        return new DemonstrativoMensalUseCase(periodos, snapshots, financeiro, editoras, competencias, relogio);
    }

    @Bean
    FechamentoMensalUseCase fechamentoMensalUseCase(PeriodoRepository periodos, ChecklistFechamentoUseCase checklist,
            DemonstrativoMensalUseCase demonstrativos, SnapshotsPort snapshots, JanelaFechamentoUseCase janela,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new FechamentoMensalUseCase(periodos, checklist, demonstrativos, snapshots, janela, auditoria, usuario,
                relogio);
    }
}
