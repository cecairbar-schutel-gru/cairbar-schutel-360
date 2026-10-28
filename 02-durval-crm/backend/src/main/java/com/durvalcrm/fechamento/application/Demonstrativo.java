package com.durvalcrm.fechamento.application;

import com.durvalcrm.fechamento.application.CompetenciasDoMesPort.ResumoCompetencias;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/**
 * Demonstrativo consolidado do mês (US-CLOSING-007): é o conteúdo gravado como versão a cada
 * fechamento. Resultado = receitas − despesas; transferências internas e obrigações com editoras ficam
 * fora dele (Spec §8).
 *
 * @param recebidoMensalidades mensalidades recebidas no mês, de qualquer competência (regime de caixa)
 */
public record Demonstrativo(YearMonth mes, List<Grupo> receitas, BigDecimal totalReceitas, List<Grupo> despesas,
        BigDecimal totalDespesas, BigDecimal resultado, List<SaldoConta> contas, List<SaldoEditora> editoras,
        BigDecimal totalEditoras, ResumoCompetencias mensalidades, BigDecimal recebidoMensalidades) {

    public record Linha(String codigo, String nome, BigDecimal valor) {
    }

    /** Categoria-mãe com as subcategorias que tiveram valor no mês. */
    public record Grupo(String codigo, String nome, BigDecimal valor, List<Linha> subcategorias) {
    }

    /** Transferências incluem as liquidações de cartão (a taxa fica nas despesas). */
    public record SaldoConta(long contaId, String nome, String tipo, BigDecimal saldoInicial, BigDecimal entradas,
            BigDecimal saidas, BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida, BigDecimal saldoFinal) {
    }

    /** Saldo devido no fim do mês; {@code transferido}: saldo passado formalmente ao mês seguinte. */
    public record SaldoEditora(long editoraId, String nome, BigDecimal saldo, boolean transferido) {
    }
}
