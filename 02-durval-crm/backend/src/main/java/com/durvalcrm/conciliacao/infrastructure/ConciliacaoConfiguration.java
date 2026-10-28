package com.durvalcrm.conciliacao.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.conciliacao.application.ConciliarContaUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.conciliacao.application.ExtratoBancarioPort;
import com.durvalcrm.conciliacao.application.LancamentosBancariosPort;
import com.durvalcrm.conciliacao.domain.ConciliacaoRepository;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.OperacoesFinanceirasUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ConciliacaoConfiguration {

    @Bean
    ConciliarContaUseCase conciliarContaUseCase(ConciliacaoRepository conciliacoes,
            LancamentosBancariosPort lancamentos, ExtratoBancarioPort extratos, MovimentoFinanceiroUseCase movimento,
            OperacoesFinanceirasUseCase operacoes, PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria,
            Clock relogio) {
        return new ConciliarContaUseCase(conciliacoes, lancamentos, extratos, movimento, operacoes, periodos, auditoria,
                relogio);
    }

    @Bean
    ConsultarConciliacoesUseCase consultarConciliacoesUseCase(ConciliacaoRepository conciliacoes,
            LancamentosBancariosPort lancamentos, ExtratoBancarioPort extratos, MovimentoFinanceiroUseCase movimento) {
        return new ConsultarConciliacoesUseCase(conciliacoes, lancamentos, extratos, movimento);
    }
}
