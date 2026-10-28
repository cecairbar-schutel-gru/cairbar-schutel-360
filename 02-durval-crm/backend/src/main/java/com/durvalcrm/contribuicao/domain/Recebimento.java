package com.durvalcrm.contribuicao.domain;

import java.math.BigDecimal;
import java.util.List;

/**
 * O que o Operador informou ao receber: quem pagou (ou anônimo), as competências escolhidas com o
 * valor de cada uma, a doação extraordinária, e a divisão por meio de pagamento.
 */
public record Recebimento(
        Long doadorId,
        boolean anonima,
        List<CompetenciaPaga> competencias,
        BigDecimal valorDoacao,
        List<Pagamento> pagamentos,
        String observacao) {

    public Recebimento {
        competencias = List.copyOf(competencias);
        pagamentos = List.copyOf(pagamentos);
        valorDoacao = valorDoacao == null ? BigDecimal.ZERO : valorDoacao;
    }
}
