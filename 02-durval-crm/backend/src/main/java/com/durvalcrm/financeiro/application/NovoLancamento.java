package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import java.time.LocalDate;
import java.util.List;

/** Lançamento pedido por um módulo; {@code origemId} é nulo nos lançamentos do próprio Financeiro. */
public record NovoLancamento(LocalDate dataFinanceira, String origemTipo, Long origemId, String descricao,
        List<LinhaConta> linhasConta, List<LinhaCategoria> linhasCategoria, Lancamento.Complemento complemento) {

    public NovoLancamento(LocalDate dataFinanceira, String origemTipo, Long origemId, String descricao,
            List<LinhaConta> linhasConta, List<LinhaCategoria> linhasCategoria) {
        this(dataFinanceira, origemTipo, origemId, descricao, linhasConta, linhasCategoria,
                Lancamento.Complemento.NENHUM);
    }
}
