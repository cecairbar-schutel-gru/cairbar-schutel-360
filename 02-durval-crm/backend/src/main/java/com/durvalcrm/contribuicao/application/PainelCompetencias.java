package com.durvalcrm.contribuicao.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** Competências de um doador para consulta e seleção (US-CONTRIB-002/003). */
public record PainelCompetencias(
        int quantidadePendentes,
        BigDecimal totalPendente,
        BigDecimal mensalidadeAtual,
        List<Item> itens,
        boolean possuiMaisAntigas) {

    public enum Situacao {
        PENDENTE,
        PAGA,
        CANCELADA,
        /** Mês ainda não gerado; só é gravado se for pago antecipadamente. */
        FUTURA
    }

    public record Item(
            YearMonth competencia,
            BigDecimal valor,
            Situacao situacao,
            boolean atrasada,
            LocalDate dataPagamento,
            String numeroRecibo,
            Long contribuicaoId) {

        public boolean selecionavel() {
            return situacao == Situacao.PENDENTE || situacao == Situacao.FUTURA;
        }
    }
}
