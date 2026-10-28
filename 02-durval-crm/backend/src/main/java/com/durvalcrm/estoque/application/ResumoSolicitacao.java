package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.MotivoBaixa;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * Linha da fila do Administrador (US-ADMIN-021) e de "Minhas solicitações" (US-SALES-021).
 * {@code precoVigente} é o preço atual do produto; {@code saldoAtual} é o do lote (baixa) ou o do
 * produto (inativação).
 */
public record ResumoSolicitacao(long id, TipoSolicitacao tipo, long produtoId, String produtoNome,
        TipoProduto produtoTipo, Long remessaId, String remessaCodigo, Integer quantidade, MotivoBaixa motivoBaixa,
        String justificativa, BigDecimal precoVigente, BigDecimal novoPreco, BigDecimal diferencaPercentual,
        boolean temFoto, StatusSolicitacao status, String solicitanteNome, Instant solicitadaEm,
        String decididaPorNome, Instant decididaEm, String motivoDecisao, boolean autoAprovada, int saldoAtual,
        Instant ultimaVenda) {
}
