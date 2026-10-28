package com.durvalcrm.relatorio.application;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

/** Estoque para o relatório e a folha de contagem (US-REPORT-007). Implementada pelo módulo Estoque. */
public interface EstoqueParaRelatorioPort {

    /** Produtos (ativos e inativos) com os filtros; {@code editoraId} é a editora do título. */
    List<ProdutoEstoque> produtos(String tipo, String categoria, Long editoraId);

    /** Saldo atual de cada lote (próprio: remessa nula; consignado: um por remessa) dos produtos. */
    List<LoteEstoque> lotes(Collection<Long> produtos);

    /**
     * Soma das quantidades dos movimentos por produto, lote e tipo: as do período [{@code inicio},
     * {@code fim}) e as posteriores a ele, para chegar ao saldo inicial e final a partir do atual.
     */
    List<SomaMovimentos> movimentos(Collection<Long> produtos, Instant inicio, Instant fim);

    record ProdutoEstoque(long id, String tipo, String nome, String categoria, String autor, Long editoraId,
            String editoraNome, boolean ativo) {
    }

    record LoteEstoque(long produtoId, Long remessaId, String remessaCodigo, Long editoraId, String editoraNome,
            int quantidade) {
    }

    /** @param tipoEstornado no movimento ESTORNO, o tipo do movimento revertido */
    record SomaMovimentos(long produtoId, Long remessaId, String tipo, String tipoEstornado, int noPeriodo,
            int depois) {
    }
}
