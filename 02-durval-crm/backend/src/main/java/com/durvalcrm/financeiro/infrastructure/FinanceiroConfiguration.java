package com.durvalcrm.financeiro.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.financeiro.application.ConciliacoesPort;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.ContasFinanceirasUseCase;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.EstornoNaOrigemPort;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.IntencoesPendentesPort;
import com.durvalcrm.financeiro.application.MensalidadesDoMesPort;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.OperacoesFinanceirasUseCase;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.financeiro.application.SaldosUseCase;
import com.durvalcrm.financeiro.application.SituacaoFechamentoPort;
import com.durvalcrm.financeiro.domain.AnexoLancamentoRepository;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ClassificacaoRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.ContasRecebimentoRepository;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FinanceiroConfiguration {

    @Bean
    MovimentoFinanceiroUseCase movimentoFinanceiroUseCase(ContaFinanceiraRepository contas,
            LancamentoRepository lancamentos, PeriodoFinanceiroPort periodos, CurrentUserPort usuario, Clock relogio) {
        return new MovimentoFinanceiroUseCase(contas, lancamentos, periodos, usuario, relogio);
    }

    @Bean
    ContasFinanceirasUseCase contasFinanceirasUseCase(ContaFinanceiraRepository contas, LancamentoRepository lancamentos,
            ContasRecebimentoRepository recebimento, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario) {
        return new ContasFinanceirasUseCase(contas, lancamentos, recebimento, auditoria, usuario);
    }

    @Bean
    ContasRecebimentoUseCase contasRecebimentoUseCase(ContasRecebimentoRepository repositorio,
            ContaFinanceiraRepository contas, MovimentoFinanceiroUseCase movimento, RegistrarAuditoriaUseCase auditoria) {
        return new ContasRecebimentoUseCase(repositorio, contas, movimento, auditoria);
    }

    @Bean
    SaldosUseCase saldosUseCase(ContaFinanceiraRepository contas, ConsultaFinanceiraPort consulta, Clock relogio) {
        return new SaldosUseCase(contas, consulta, relogio);
    }

    @Bean
    OperacoesFinanceirasUseCase operacoesFinanceirasUseCase(MovimentoFinanceiroUseCase movimento,
            ContaFinanceiraRepository contas, LancamentoRepository lancamentos, CategoriaRepository categorias,
            ClassificacaoRepository classificacoes, AnexoLancamentoRepository anexos, PeriodoFinanceiroPort periodos,
            RegistrarAuditoriaUseCase auditoria, ObjectProvider<EstornoNaOrigemPort> origens, Clock relogio) {
        return new OperacoesFinanceirasUseCase(movimento, contas, lancamentos, categorias, classificacoes, anexos,
                periodos, auditoria, origens.orderedStream().toList(), relogio);
    }

    @Bean
    ConsultarLancamentosUseCase consultarLancamentosUseCase(LancamentoRepository lancamentos,
            ContaFinanceiraRepository contas, CategoriaRepository categorias, ClassificacaoRepository classificacoes,
            AnexoLancamentoRepository anexos, ConsultaFinanceiraPort consulta, PeriodoFinanceiroPort periodos) {
        return new ConsultarLancamentosUseCase(lancamentos, contas, categorias, classificacoes, anexos, consulta,
                periodos);
    }

    @Bean
    PainelTesoureiroUseCase painelTesoureiroUseCase(SaldosUseCase saldos, ConsultaFinanceiraPort consulta,
            MensalidadesDoMesPort mensalidades, IntencoesPendentesPort intencoes, ConciliacoesPort conciliacoes,
            SituacaoFechamentoPort fechamento, Clock relogio) {
        return new PainelTesoureiroUseCase(saldos, consulta, mensalidades, intencoes, conciliacoes, fechamento,
                relogio);
    }

    @Bean
    DemonstrativoFinanceiroUseCase demonstrativoFinanceiroUseCase(ContaFinanceiraRepository contas,
            CategoriaRepository categorias, ConsultaFinanceiraPort consulta) {
        return new DemonstrativoFinanceiroUseCase(contas, categorias, consulta);
    }
}
