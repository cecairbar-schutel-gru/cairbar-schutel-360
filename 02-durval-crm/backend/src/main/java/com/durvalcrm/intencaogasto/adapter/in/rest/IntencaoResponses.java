package com.durvalcrm.intencaogasto.adapter.in.rest;

import com.durvalcrm.intencaogasto.application.AprovarGastoUseCase.Resultado;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.InfoAnexo;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.ItemResumo;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.ResumoIntencao;
import com.durvalcrm.intencaogasto.application.DetalheIntencao;
import com.durvalcrm.intencaogasto.application.DetalheIntencao.Acoes;
import com.durvalcrm.intencaogasto.application.SolicitarGastoUseCase.MinhaIntencao;
import com.durvalcrm.intencaogasto.domain.Aprovacao;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.ItemCompra;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** DTOs HTTP de saída das intenções de gasto. */
final class IntencaoResponses {

    private IntencaoResponses() {
    }

    /** Linha das listas; {@code novidade} só em "Minhas intenções". */
    record ResumoResponse(long id, Instant criadaEm, String solicitanteNome, String descricao, String categoria,
            String categoriaNome, BigDecimal valorSolicitado, BigDecimal valorAprovado, StatusIntencao status,
            Instant statusAlteradoEm, int anexos, List<ItemResumo> itens, boolean novidade) {

        static ResumoResponse de(ResumoIntencao r, boolean novidade) {
            return new ResumoResponse(r.id(), r.criadaEm(), r.solicitanteNome(), r.descricao(), r.categoria(),
                    r.categoriaNome(), r.valorSolicitado(), r.valorAprovado(), r.status(), r.statusAlteradoEm(),
                    r.anexos(), r.itens(), novidade);
        }

        static ResumoResponse de(ResumoIntencao r) {
            return de(r, false);
        }

        static ResumoResponse de(MinhaIntencao m) {
            return de(m.intencao(), m.novidade());
        }
    }

    record EventoResponse(String tipo, String usuario, Instant em, String descricao) {
    }

    record DetalheResponse(long id, String descricao, String categoria, String categoriaNome,
            BigDecimal valorSolicitado, String justificativa, StatusIntencao status, String solicitanteNome,
            Instant criadaEm, Instant statusAlteradoEm, boolean compraCantina, List<ItemCompra> itens,
            Aprovacao aprovacao, String decididaPorNome, Instant decididaEm, String motivoRejeicao,
            String recebidaPorNome, Instant recebidaEm, String divergencia, String canceladaPorNome,
            Instant canceladaEm, String motivoCancelamento, List<InfoAnexo> anexos, List<EventoResponse> historico,
            BigDecimal gastoNoMes, Acoes acoes) {

        static DetalheResponse de(DetalheIntencao d) {
            IntencaoGasto i = d.intencao();
            return new DetalheResponse(i.getId(), i.getDescricao(), i.getCategoria(), d.categoriaNome(),
                    i.getValorSolicitado(), i.getJustificativa(), i.getStatus(), i.getSolicitanteNome(),
                    i.getCriadaEm(), i.getStatusAlteradoEm(), i.compraDaCantina(), i.getItens(), i.getAprovacao(),
                    i.getDecididaPorNome(), i.getDecididaEm(), i.getMotivoRejeicao(), i.getRecebidaPorNome(),
                    i.getRecebidaEm(), i.getDivergencia(), i.getCanceladaPorNome(), i.getCanceladaEm(),
                    i.getMotivoCancelamento(), d.anexos(), d.historico().stream()
                            .map(e -> new EventoResponse(e.tipo().name(), e.usuarioNome(), e.em(), e.descricao()))
                            .toList(),
                    d.gastoNoMes(), d.acoes());
        }
    }

    /** Resultado das ações: a nova situação, a despesa gerada (se houver) e avisos que não bloqueiam. */
    record AcaoResponse(long id, StatusIntencao status, Long lancamentoId, List<String> avisos) {

        static AcaoResponse de(IntencaoGasto i) {
            return new AcaoResponse(i.getId(), i.getStatus(), null, List.of());
        }

        static AcaoResponse de(Resultado r) {
            return new AcaoResponse(r.intencao().getId(), r.intencao().getStatus(), r.lancamentoId(), r.avisos());
        }
    }
}
