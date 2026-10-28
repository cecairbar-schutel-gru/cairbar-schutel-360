package com.durvalcrm.intencaogasto.domain;

import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * Como a despesa foi paga (US-EXPENSE-004): valor e subcategoria confirmados ou ajustados, meio,
 * conta de origem, data e o lançamento gerado (nulo só até a despesa ser gravada).
 */
public record Aprovacao(BigDecimal valor, String categoria, String categoriaNome, MeioPagamentoGasto meio,
        long contaId, String contaNome, LocalDate data, String nota, Long lancamentoId) {

    public Aprovacao {
        Objects.requireNonNull(valor);
        Objects.requireNonNull(categoria);
        Objects.requireNonNull(meio);
        Objects.requireNonNull(contaNome);
        Objects.requireNonNull(data);
    }

    /** A despesa sai da conta de origem. */
    public List<LinhaConta> linhasConta() {
        return List.of(new LinhaConta(contaId, valor.negate()));
    }

    public List<LinhaCategoria> linhasCategoria() {
        return List.of(new LinhaCategoria(categoria, valor.negate()));
    }

    Aprovacao comLancamento(long id) {
        return new Aprovacao(valor, categoria, categoriaNome, meio, contaId, contaNome, data, nota, id);
    }

    Aprovacao comValor(BigDecimal novo) {
        return new Aprovacao(novo, categoria, categoriaNome, meio, contaId, contaNome, data, nota, lancamentoId);
    }
}
