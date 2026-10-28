package com.durvalcrm.relatorio.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** Acertos com editoras no período (US-REPORT-009). Implementada pelo módulo Editoras. */
public interface EditorasParaRelatorioPort {

    /**
     * Editoras que já tiveram obrigação ou pagamento, com os números do período, como na apuração
     * mensal (US-PUBLISHER-007): saldo no fim do dia anterior ao início, obrigações criadas por venda e
     * por dano/extravio, estornos de obrigações, pagamentos (menos os estornados no período) e os saldos
     * transferidos formalmente ao mês seguinte nos meses que terminam no período.
     */
    List<MovimentoEditora> acertos(LocalDate de, LocalDate ate);

    record MovimentoEditora(long editoraId, String nome, BigDecimal saldoInicial, BigDecimal obrigacoesVendas,
            BigDecimal obrigacoesBaixas, BigDecimal estornos, BigDecimal pagamentos, BigDecimal transferido) {
    }
}
