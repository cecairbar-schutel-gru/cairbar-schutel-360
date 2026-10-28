package com.durvalcrm.relatorio.application;

import com.durvalcrm.relatorio.application.MensalidadesParaRelatorioPort.CompetenciasDoMes;
import com.durvalcrm.relatorio.application.MensalidadesParaRelatorioPort.DoadorComPendencias;
import com.durvalcrm.relatorio.application.MensalidadesParaRelatorioPort.MensalidadeRecebida;
import com.durvalcrm.relatorio.domain.ClasseRecebimento;
import com.durvalcrm.relatorio.domain.Percentual;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relatório das mensalidades (US-REPORT-004; Spec §8 "Competências corretamente acompanhadas"): a
 * situação das competências por mês, o que foi recebido no período (de meses anteriores, do mês e
 * antecipado) e os doadores ativos com três ou mais competências pendentes, para planejar contatos.
 */
public class RelatorioMensalidadesUseCase {

    static final int MINIMO_PENDENTES = 3;
    static final int MAXIMO_MESES = 36;

    private final MensalidadesParaRelatorioPort mensalidades;
    private final Clock relogio;

    public RelatorioMensalidadesUseCase(MensalidadesParaRelatorioPort mensalidades, Clock relogio) {
        this.mensalidades = mensalidades;
        this.relogio = relogio;
    }

    /** Taxa de pagamento = pagas / (geradas − canceladas), em %; nula sem competências válidas. */
    public record SituacaoCompetencias(YearMonth mes, long geradas, long pagas, long pendentes, long canceladas,
            BigDecimal valorGerado, BigDecimal valorPago, BigDecimal valorPendente, BigDecimal taxaPagamento) {
    }

    public record Recebido(long quantidade, BigDecimal valor) {
        static final Recebido ZERO = new Recebido(0, BigDecimal.ZERO);

        Recebido mais(long q, BigDecimal v) {
            return new Recebido(quantidade + q, valor.add(v));
        }
    }

    /** {@code mes} nulo na linha de total do período. */
    public record RecebimentoMensalidades(YearMonth mes, Recebido atrasadas, Recebido mesCorrente, Recebido antecipadas,
            Recebido total) {
    }

    public record RelatorioMensalidades(YearMonth competenciaDe, YearMonth competenciaAte,
            List<SituacaoCompetencias> porCompetencia, SituacaoCompetencias totalCompetencias, LocalDate de,
            LocalDate ate, List<RecebimentoMensalidades> recebimentosPorMes, RecebimentoMensalidades recebimentos,
            List<DoadorComPendencias> doadoresComPendencias) {
    }

    /** Sem meses: os seis últimos até o atual. Sem período de recebimento: o mês atual. */
    @Transactional(readOnly = true)
    public RelatorioMensalidades gerar(YearMonth competenciaDe, YearMonth competenciaAte, PeriodoRelatorio recebimento) {
        YearMonth atual = YearMonth.now(relogio);
        YearMonth ate = competenciaAte == null ? atual : competenciaAte;
        YearMonth de = competenciaDe == null ? ate.minusMonths(5) : competenciaDe;
        if (de.isAfter(ate)) {
            throw ValidacaoException.doCampo("competenciaAte", "O mês final deve ser igual ou posterior ao inicial.");
        }
        if (ChronoUnit.MONTHS.between(de, ate) >= MAXIMO_MESES) {
            throw ValidacaoException.doCampo("competenciaAte", "Escolha até 36 meses de competências.");
        }
        Map<YearMonth, CompetenciasDoMes> porMes = mensalidades.competencias(de, ate).stream()
                .collect(Collectors.toMap(CompetenciasDoMes::mes, Function.identity()));
        List<SituacaoCompetencias> linhas = new ArrayList<>();
        for (YearMonth m = de; !m.isAfter(ate); m = m.plusMonths(1)) {
            CompetenciasDoMes c = porMes.getOrDefault(m, new CompetenciasDoMes(m, 0, 0, 0, 0, BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO));
            linhas.add(situacao(c));
        }
        SituacaoCompetencias total = situacao(new CompetenciasDoMes(null, somar(linhas, SituacaoCompetencias::geradas),
                somar(linhas, SituacaoCompetencias::pagas), somar(linhas, SituacaoCompetencias::pendentes),
                somar(linhas, SituacaoCompetencias::canceladas), somarValor(linhas, SituacaoCompetencias::valorGerado),
                somarValor(linhas, SituacaoCompetencias::valorPago), somarValor(linhas, SituacaoCompetencias::valorPendente)));

        Map<YearMonth, RecebimentoMensalidades> recebidos = new TreeMap<>();
        RecebimentoMensalidades geral = vazio(null);
        for (MensalidadeRecebida r : mensalidades.recebidas(recebimento.de(), recebimento.ate())) {
            YearMonth mesRecebimento = YearMonth.from(r.data());
            recebidos.put(mesRecebimento, somar(recebidos.getOrDefault(mesRecebimento, vazio(mesRecebimento)), r));
            geral = somar(geral, r);
        }
        return new RelatorioMensalidades(de, ate, linhas, total, recebimento.de(), recebimento.ate(),
                List.copyOf(recebidos.values()), geral, mensalidades.doadoresComPendencias(MINIMO_PENDENTES, atual));
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    private static SituacaoCompetencias situacao(CompetenciasDoMes c) {
        return new SituacaoCompetencias(c.mes(), c.geradas(), c.pagas(), c.pendentes(), c.canceladas(), c.valorGerado(),
                c.valorPago(), c.valorPendente(), Percentual.de(c.pagas(), c.geradas() - c.canceladas()));
    }

    private static RecebimentoMensalidades vazio(YearMonth mes) {
        return new RecebimentoMensalidades(mes, Recebido.ZERO, Recebido.ZERO, Recebido.ZERO, Recebido.ZERO);
    }

    /** O cancelamento entra com quantidade e valor negativos, no mês do estorno. */
    private static RecebimentoMensalidades somar(RecebimentoMensalidades r, MensalidadeRecebida m) {
        long q = m.estorno() ? -1 : 1;
        BigDecimal v = m.estorno() ? m.valor().negate() : m.valor();
        ClasseRecebimento classe = ClasseRecebimento.de(m.competencia(), m.data());
        return new RecebimentoMensalidades(r.mes(),
                classe == ClasseRecebimento.ATRASADA ? r.atrasadas().mais(q, v) : r.atrasadas(),
                classe == ClasseRecebimento.MES_CORRENTE ? r.mesCorrente().mais(q, v) : r.mesCorrente(),
                classe == ClasseRecebimento.ANTECIPADA ? r.antecipadas().mais(q, v) : r.antecipadas(),
                r.total().mais(q, v));
    }

    private static long somar(List<SituacaoCompetencias> l, Function<SituacaoCompetencias, Long> f) {
        return l.stream().mapToLong(f::apply).sum();
    }

    private static BigDecimal somarValor(List<SituacaoCompetencias> l, Function<SituacaoCompetencias, BigDecimal> f) {
        return l.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
