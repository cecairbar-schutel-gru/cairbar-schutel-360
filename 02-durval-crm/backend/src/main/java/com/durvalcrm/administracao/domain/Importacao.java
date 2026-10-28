package com.durvalcrm.administracao.domain;

import java.time.YearMonth;
import java.util.List;
import java.util.Objects;

/**
 * Importação concluída (US-ADMIN-012): arquivo, autor, contagem de linhas, ids criados (lançamentos
 * ou doadores) e meses fechados por ela. Pode ser desfeita por inteiro enquanto nada foi lançado
 * sobre o que ela criou.
 */
public record Importacao(Long id, TipoImportacao tipo, String arquivo, Autor autor, int linhasTotal,
        int linhasImportadas, List<Long> criados, List<YearMonth> mesesFechados, boolean desfeita, Autor desfeitaPor) {

    public Importacao {
        Objects.requireNonNull(tipo);
        criados = List.copyOf(criados);
        mesesFechados = List.copyOf(mesesFechados);
    }
}
