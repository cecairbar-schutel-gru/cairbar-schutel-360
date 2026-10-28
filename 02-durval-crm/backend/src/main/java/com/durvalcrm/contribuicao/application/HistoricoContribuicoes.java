package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;

/** Aba "Contribuições" do perfil do doador (US-CONTRIB-012). */
public record HistoricoContribuicoes(int ano, List<Integer> anosDisponiveis, BigDecimal totalNoAno, List<Item> itens) {

    public record Item(
            long id,
            Instant recebidaEm,
            String numeroRecibo,
            TipoContribuicao tipo,
            List<YearMonth> competencias,
            BigDecimal valorDoacao,
            BigDecimal total,
            List<MeioPagamento> meios,
            StatusContribuicao status,
            String motivoCancelamento) {
    }
}
