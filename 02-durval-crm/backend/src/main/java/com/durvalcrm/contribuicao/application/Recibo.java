package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.CompetenciaPaga;
import com.durvalcrm.contribuicao.domain.Pagamento;
import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import com.durvalcrm.shared.application.DadosOrganizacao;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Comprovante digital (US-CONTRIB-009). O nome do doador é lido no momento da emissão, então um
 * doador anonimizado nunca reaparece numa 2ª via.
 */
public record Recibo(
        long contribuicaoId,
        String numero,
        Instant recebidaEm,
        TipoContribuicao tipo,
        Long doadorId,
        String doadorNome,
        List<CompetenciaPaga> competencias,
        BigDecimal valorDoacao,
        List<Pagamento> pagamentos,
        BigDecimal total,
        String observacao,
        String operadorNome,
        StatusContribuicao status,
        Instant canceladaEm,
        String motivoCancelamento,
        boolean segundaVia,
        DadosOrganizacao organizacao) {

    public static final String NOME_ANONIMO = "Doação anônima";
}
