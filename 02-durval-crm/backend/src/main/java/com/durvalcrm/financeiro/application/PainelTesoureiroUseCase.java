package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.Cancelamento;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.ResumoPeriodo;
import com.durvalcrm.financeiro.application.MensalidadesDoMesPort.ResumoMensalidades;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Painel do Tesoureiro (US-FINANCIAL-015, wireframe 3): visão financeira do mês, saldos por tipo de
 * conta, intenções de gasto pendentes, conciliações pendentes, situação do período e o que mudou nos
 * últimos 7 dias. O período é o resumo do checklist do fechamento mensal (US-CLOSING-001).
 */
public class PainelTesoureiroUseCase {

    static final Duration JANELA_RECENTE = Duration.ofDays(7);

    private final SaldosUseCase saldos;
    private final ConsultaFinanceiraPort consulta;
    private final MensalidadesDoMesPort mensalidades;
    private final IntencoesPendentesPort intencoes;
    private final ConciliacoesPort conciliacoes;
    private final SituacaoFechamentoPort fechamento;
    private final Clock relogio;

    public PainelTesoureiroUseCase(SaldosUseCase saldos, ConsultaFinanceiraPort consulta,
            MensalidadesDoMesPort mensalidades, IntencoesPendentesPort intencoes, ConciliacoesPort conciliacoes,
            SituacaoFechamentoPort fechamento, Clock relogio) {
        this.saldos = saldos;
        this.consulta = consulta;
        this.mensalidades = mensalidades;
        this.intencoes = intencoes;
        this.conciliacoes = conciliacoes;
        this.fechamento = fechamento;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public PainelTesoureiro painel() {
        LocalDate hoje = LocalDate.now(relogio);
        YearMonth mes = YearMonth.from(hoje);
        Instant desde = relogio.instant().minus(JANELA_RECENTE);
        QuadroSaldos quadro = saldos.saldos(null);
        ResumoPeriodo resumo = consulta.resumo(mes.atDay(1), mes.atEndOfMonth());
        Map<Long, Long> naoConciliados = consulta.naoConciliadosPorBanco();
        Map<Long, LocalDate> conciliadasAte = conciliacoes.conciliadasAte();
        List<ConciliacaoPendente> pendentes = quadro.bancos().stream()
                .map(s -> new ConciliacaoPendente(s.conta(), naoConciliados.getOrDefault(s.conta().id(), 0L),
                        conciliadasAte.get(s.conta().id())))
                .toList();
        return new PainelTesoureiro(mes, mensalidades.resumo(mes), resumo,
                resumo.receitas().subtract(resumo.taxasCartao()), quadro, intencoes.pendentes(), pendentes,
                fechamento.situacao(),
                consulta.cancelamentosDesde(desde));
    }

    /**
     * @param receitaLiquida       receitas do mês (regime de caixa) menos as taxas de cartão
     * @param intencoesPendentes   intenções de gasto à espera de decisão (US-EXPENSE-002)
     */
    public record PainelTesoureiro(YearMonth mes, ResumoMensalidades mensalidades, ResumoPeriodo resumoDoMes,
            BigDecimal receitaLiquida, QuadroSaldos saldos, Long intencoesPendentes,
            List<ConciliacaoPendente> conciliacoes, SituacaoPeriodo periodo, List<Cancelamento> cancelamentosRecentes) {
    }

    /** {@code ultimaConciliacao}: data final da última conciliação concluída (nula se nunca conciliada). */
    public record ConciliacaoPendente(ContaFinanceira conta, long naoConciliados, LocalDate ultimaConciliacao) {
    }

    /**
     * Mês a fechar (o mais antigo aberto que já terminou) com o checklist; sem mês a fechar, o mês atual
     * em andamento e itens nulos.
     *
     * @param situacao ABERTO, REABERTO ou EM_ANDAMENTO
     */
    public record SituacaoPeriodo(YearMonth mes, String situacao, Integer itensConcluidos, Integer itensTotal) {
    }
}
