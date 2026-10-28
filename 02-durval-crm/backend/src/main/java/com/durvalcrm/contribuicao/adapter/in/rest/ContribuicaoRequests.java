package com.durvalcrm.contribuicao.adapter.in.rest;

import com.durvalcrm.contribuicao.application.RegistrarContribuicaoCommand;
import com.durvalcrm.contribuicao.application.RegistrarMensagemPreparadaUseCase.Canal;
import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.shared.domain.TipoCartao;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

final class ContribuicaoRequests {

    private ContribuicaoRequests() {
    }

    record PagamentoRequest(MeioPagamento meio, BigDecimal valor, TipoCartao tipoCartao) {
    }

    record ContribuicaoRequest(Long doadorId, boolean anonima, List<YearMonth> competencias, BigDecimal valorDoacao,
            List<PagamentoRequest> pagamentos, String observacao, String chaveIdempotencia) {

        RegistrarContribuicaoCommand paraComando() {
            return new RegistrarContribuicaoCommand(doadorId, anonima, competencias, valorDoacao,
                    pagamentos == null ? List.of() : pagamentos.stream()
                            .map(p -> new RegistrarContribuicaoCommand.Pagamento(p.meio(), p.valor(), p.tipoCartao()))
                            .toList(),
                    observacao, chaveIdempotencia);
        }
    }

    record CancelamentoRequest(String motivo) {
    }

    record MensagemRequest(Canal canal) {
    }
}
