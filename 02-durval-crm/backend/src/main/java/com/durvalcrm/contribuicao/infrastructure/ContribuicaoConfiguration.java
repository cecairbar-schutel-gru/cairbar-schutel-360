package com.durvalcrm.contribuicao.infrastructure;

import com.durvalcrm.administracao.application.MensalidadeUseCase;
import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.CancelarContribuicaoUseCase;
import com.durvalcrm.contribuicao.application.ConsultarCompetenciasUseCase;
import com.durvalcrm.contribuicao.application.ConsultarContribuicoesUseCase;
import com.durvalcrm.contribuicao.application.DoadoresPort;
import com.durvalcrm.contribuicao.application.ExecucoesGeracaoPort;
import com.durvalcrm.contribuicao.application.GeradorReciboPdfPort;
import com.durvalcrm.contribuicao.application.GerarCompetenciasMensaisUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.contribuicao.application.MensalidadeVigentePort;
import com.durvalcrm.contribuicao.application.NumeracaoReciboPort;
import com.durvalcrm.contribuicao.application.OpcoesPagamentoUseCase;
import com.durvalcrm.contribuicao.application.RegistrarContribuicaoUseCase;
import com.durvalcrm.contribuicao.application.RegistrarMensagemPreparadaUseCase;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ContribuicaoConfiguration {

    /** O valor de cada mês vem do histórico mantido pela Administração (US-ADMIN-002). */
    @Bean
    MensalidadeVigentePort mensalidadeVigente(MensalidadeUseCase mensalidade) {
        return mensalidade::valorPara;
    }

    @Bean
    GerenciarCompetenciasDoDoadorUseCase gerenciarCompetenciasDoDoadorUseCase(CompetenciaRepository repositorio,
            MensalidadeVigentePort mensalidade, Clock relogio) {
        return new GerenciarCompetenciasDoDoadorUseCase(repositorio, mensalidade, relogio);
    }

    @Bean
    ConsultarCompetenciasUseCase consultarCompetenciasUseCase(CompetenciaRepository repositorio, DoadoresPort doadores,
            MensalidadeVigentePort mensalidade, Clock relogio) {
        return new ConsultarCompetenciasUseCase(repositorio, doadores, mensalidade, relogio);
    }

    @Bean
    OpcoesPagamentoUseCase opcoesPagamentoUseCase(ContasRecebimentoUseCase recebimento) {
        return new OpcoesPagamentoUseCase(recebimento);
    }

    @Bean
    RegistrarContribuicaoUseCase registrarContribuicaoUseCase(ContribuicaoRepository contribuicoes,
            CompetenciaRepository competencias, DoadoresPort doadores, MensalidadeVigentePort mensalidade,
            NumeracaoReciboPort numeracao, MovimentoFinanceiroUseCase financeiro, OpcoesPagamentoUseCase opcoes,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new RegistrarContribuicaoUseCase(contribuicoes, competencias, doadores, mensalidade, numeracao,
                financeiro, opcoes, auditoria, usuario, relogio);
    }

    @Bean
    CancelarContribuicaoUseCase cancelarContribuicaoUseCase(ContribuicaoRepository contribuicoes,
            CompetenciaRepository competencias, MovimentoFinanceiroUseCase financeiro,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new CancelarContribuicaoUseCase(contribuicoes, competencias, financeiro, auditoria, usuario, relogio);
    }

    @Bean
    ConsultarContribuicoesUseCase consultarContribuicoesUseCase(ContribuicaoRepository contribuicoes,
            DoadoresPort doadores, DadosOrganizacaoPort organizacao, GeradorReciboPdfPort pdf,
            CurrentUserPort usuario, Clock relogio) {
        return new ConsultarContribuicoesUseCase(contribuicoes, doadores, organizacao, pdf, usuario, relogio);
    }

    @Bean
    RegistrarMensagemPreparadaUseCase registrarMensagemPreparadaUseCase(ContribuicaoRepository contribuicoes,
            RegistrarAuditoriaUseCase auditoria) {
        return new RegistrarMensagemPreparadaUseCase(contribuicoes, auditoria);
    }

    @Bean
    GerarCompetenciasMensaisUseCase gerarCompetenciasMensaisUseCase(CompetenciaRepository competencias,
            DoadoresPort doadores, MensalidadeVigentePort mensalidade, ExecucoesGeracaoPort execucoes,
            RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        return new GerarCompetenciasMensaisUseCase(competencias, doadores, mensalidade, execucoes, auditoria, relogio);
    }
}
