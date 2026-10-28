package com.durvalcrm.relatorio.application;

import com.durvalcrm.relatorio.application.EditorasParaRelatorioPort.MovimentoEditora;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Function;
import org.springframework.transaction.annotation.Transactional;

/**
 * Acertos com editoras (US-REPORT-009): por editora, saldo inicial + obrigações (vendas e
 * dano/extravio) − estornos − pagamentos = saldo final, e o total de todas. A transferência do saldo
 * ao mês seguinte é só a decisão registrada no fechamento: não muda o saldo devido.
 */
public class RelatorioEditorasUseCase {

    private final EditorasParaRelatorioPort editoras;
    private final Clock relogio;

    public RelatorioEditorasUseCase(EditorasParaRelatorioPort editoras, Clock relogio) {
        this.editoras = editoras;
        this.relogio = relogio;
    }

    /** {@code editoraId} nulo na linha de total. */
    public record AcertoEditora(Long editoraId, String nome, BigDecimal saldoInicial, BigDecimal obrigacoesVendas,
            BigDecimal obrigacoesBaixas, BigDecimal estornos, BigDecimal pagamentos, BigDecimal transferido,
            BigDecimal saldoFinal) {
    }

    public record RelatorioEditoras(LocalDate de, LocalDate ate, List<AcertoEditora> editoras, AcertoEditora total) {
    }

    @Transactional(readOnly = true)
    public RelatorioEditoras gerar(PeriodoRelatorio periodo) {
        List<AcertoEditora> lista = new ArrayList<>();
        for (MovimentoEditora m : editoras.acertos(periodo.de(), periodo.ate())) {
            BigDecimal fim = m.saldoInicial().add(m.obrigacoesVendas()).add(m.obrigacoesBaixas()).subtract(m.estornos())
                    .subtract(m.pagamentos());
            AcertoEditora a = new AcertoEditora(m.editoraId(), m.nome(), m.saldoInicial(), m.obrigacoesVendas(),
                    m.obrigacoesBaixas(), m.estornos(), m.pagamentos(), m.transferido(), fim);
            boolean semNada = List.of(a.saldoInicial(), a.obrigacoesVendas(), a.obrigacoesBaixas(), a.estornos(),
                    a.pagamentos(), a.saldoFinal()).stream().allMatch(v -> v.signum() == 0);
            if (!semNada) {
                lista.add(a);
            }
        }
        lista.sort(Comparator.comparing(AcertoEditora::nome, String.CASE_INSENSITIVE_ORDER));
        AcertoEditora total = new AcertoEditora(null, "Total", somar(lista, AcertoEditora::saldoInicial),
                somar(lista, AcertoEditora::obrigacoesVendas), somar(lista, AcertoEditora::obrigacoesBaixas),
                somar(lista, AcertoEditora::estornos), somar(lista, AcertoEditora::pagamentos),
                somar(lista, AcertoEditora::transferido), somar(lista, AcertoEditora::saldoFinal));
        return new RelatorioEditoras(periodo.de(), periodo.ate(), lista, total);
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    private static BigDecimal somar(List<AcertoEditora> l, Function<AcertoEditora, BigDecimal> f) {
        return l.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
