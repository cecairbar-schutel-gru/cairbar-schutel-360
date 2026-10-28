package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.AlteracaoPreco;
import com.durvalcrm.estoque.domain.TipoProduto;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Página do produto (US-INVENTORY-001/009): cadastro, saldo por lote, preços e pedidos pendentes. */
public record DetalheProduto(long id, TipoProduto tipo, String nome, String categoria, String autor, String isbn,
        Long editoraId, String editoraNome, BigDecimal preco, BigDecimal repassePadrao, boolean ativo, int saldo,
        int aguardandoBaixa, List<LoteDetalhado> lotes, List<AlteracaoPreco> historicoPrecos, Instant ultimaVenda,
        boolean possuiHistorico, boolean precoPendente, boolean inativacaoPendente) {
}
