package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.MeioPagamentoGasto;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Entradas dos casos de uso das intenções de gasto. */
public final class Comandos {

    private Comandos() {
    }

    /** US-EXPENSE-001: itens só na compra da cantina, na ordem informada. */
    public record NovaIntencao(String descricao, String categoria, BigDecimal valor, String justificativa,
            List<ItemPedido> itens, List<AnexoIntencao> anexos) {
    }

    public record ItemPedido(Long produtoId, Integer quantidade) {
    }

    /** US-EXPENSE-004. */
    public record AprovacaoCommand(BigDecimal valor, String categoria, MeioPagamentoGasto meio, Long contaId,
            LocalDate data, String nota) {
    }

    /** US-EXPENSE-006: quantidade recebida por produto. */
    public record RecebimentoCommand(Map<Long, Integer> quantidades, String divergencia) {
    }

    /** US-EXPENSE-007: quantidades acordadas por produto e o valor pago, se mudou. */
    public record CorrecaoCommand(Map<Long, Integer> quantidades, BigDecimal valor, String motivo) {
    }
}
