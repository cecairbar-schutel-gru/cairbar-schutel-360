package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/**
 * Confirmação de uma contribuição. Não se informa conta: cada meio entra na conta de recebimento
 * definida pelo Administrador.
 */
public record RegistrarContribuicaoCommand(
        Long doadorId,
        boolean anonima,
        List<YearMonth> competencias,
        BigDecimal valorDoacao,
        List<Pagamento> pagamentos,
        String observacao,
        String chaveIdempotencia) {

    public RegistrarContribuicaoCommand {
        competencias = competencias == null ? List.of() : List.copyOf(competencias);
        pagamentos = pagamentos == null ? List.of() : List.copyOf(pagamentos);
    }

    public record Pagamento(MeioPagamento meio, BigDecimal valor, TipoCartao tipoCartao) {
    }
}
