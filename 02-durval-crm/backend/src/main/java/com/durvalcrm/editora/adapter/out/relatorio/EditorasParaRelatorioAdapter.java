package com.durvalcrm.editora.adapter.out.relatorio;

import com.durvalcrm.editora.application.ConsultaEditorasPort;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaObrigacao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaPagamento;
import com.durvalcrm.editora.application.ConsultaEditorasPort.SaldoEditora;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.TransferenciaSaldo;
import com.durvalcrm.editora.domain.TransferenciaSaldoRepository;
import com.durvalcrm.relatorio.application.EditorasParaRelatorioPort;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

/**
 * Acertos com editoras no período (US-REPORT-009), com as mesmas regras da apuração mensal
 * (US-PUBLISHER-007): pagamentos estornados no período saem dos pagamentos.
 */
@Component
class EditorasParaRelatorioAdapter implements EditorasParaRelatorioPort {

    private final ConsultaEditorasPort consulta;
    private final TransferenciaSaldoRepository transferencias;

    EditorasParaRelatorioAdapter(ConsultaEditorasPort consulta, TransferenciaSaldoRepository transferencias) {
        this.consulta = consulta;
        this.transferencias = transferencias;
    }

    @Override
    public List<MovimentoEditora> acertos(LocalDate de, LocalDate ate) {
        // Transferências dos meses que terminam dentro do período.
        Map<Long, BigDecimal> transferido = new HashMap<>();
        for (YearMonth m = YearMonth.from(de); !m.atEndOfMonth().isAfter(ate); m = m.plusMonths(1)) {
            for (TransferenciaSaldo t : transferencias.doMes(m)) {
                transferido.merge(t.editoraId(), t.valor(), BigDecimal::add);
            }
        }
        List<MovimentoEditora> lista = new ArrayList<>();
        for (SaldoEditora e : consulta.saldos(ate)) {
            long id = e.editoraId();
            List<LinhaObrigacao> criadas = consulta.obrigacoes(id, de, ate);
            List<LinhaPagamento> pagamentos = consulta.pagamentos(id, de, ate);
            BigDecimal pagos = soma(pagamentos.stream().filter(p -> dentro(p.pagoEm(), de, ate)).map(LinhaPagamento::valor));
            BigDecimal desfeitos = soma(pagamentos.stream().filter(p -> dentro(p.estornadoEm(), de, ate))
                    .map(LinhaPagamento::valor));
            lista.add(new MovimentoEditora(id, e.nome(), consulta.saldoEm(id, de.minusDays(1)),
                    soma(criadas.stream().filter(o -> o.origem() == OrigemObrigacao.VENDA).map(LinhaObrigacao::valor)),
                    soma(criadas.stream().filter(o -> o.origem() == OrigemObrigacao.BAIXA).map(LinhaObrigacao::valor)),
                    soma(consulta.obrigacoesEstornadas(id, de, ate).stream().map(LinhaObrigacao::valor)),
                    pagos.subtract(desfeitos), transferido.getOrDefault(id, BigDecimal.ZERO)));
        }
        return lista;
    }

    private static boolean dentro(LocalDate data, LocalDate de, LocalDate ate) {
        return data != null && !data.isBefore(de) && !data.isAfter(ate);
    }

    private static BigDecimal soma(Stream<BigDecimal> valores) {
        return valores.reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
