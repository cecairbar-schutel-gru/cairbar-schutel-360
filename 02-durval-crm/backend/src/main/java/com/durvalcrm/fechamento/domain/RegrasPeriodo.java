package com.durvalcrm.fechamento.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Optional;

/**
 * Ordem dos fechamentos (US-CLOSING, "Period Rules"): o primeiro período é o mês da data de corte mais
 * antiga; os meses fecham em ordem, só depois de terminarem e depois do anterior fechado. Só o mês
 * fechado mais recente pode ser reaberto.
 */
public final class RegrasPeriodo {

    public static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("MM/yyyy");

    private RegrasPeriodo() {
    }

    /** O mês mais antigo que já terminou e não está fechado; vazio se todos até o mês passado estão fechados. */
    public static Optional<YearMonth> mesAFechar(YearMonth primeiro, Map<YearMonth, StatusPeriodo> situacoes,
            YearMonth atual) {
        if (primeiro == null) {
            return Optional.empty();
        }
        for (YearMonth m = primeiro; m.isBefore(atual); m = m.plusMonths(1)) {
            if (situacoes.getOrDefault(m, StatusPeriodo.ABERTO) != StatusPeriodo.FECHADO) {
                return Optional.of(m);
            }
        }
        return Optional.empty();
    }

    /** O mês fechado mais recente (o único que pode ser reaberto). */
    public static Optional<YearMonth> ultimoFechado(Map<YearMonth, StatusPeriodo> situacoes) {
        return situacoes.entrySet().stream().filter(e -> e.getValue() == StatusPeriodo.FECHADO)
                .map(Map.Entry::getKey).max(YearMonth::compareTo);
    }

    public static void exigirVezDeFechar(YearMonth mes, Optional<YearMonth> aFechar, YearMonth atual) {
        if (!mes.isBefore(atual)) {
            throw new RegraDeNegocioException("PERIODO_EM_ANDAMENTO",
                    "O mês de " + MES.format(mes) + " ainda não terminou e não pode ser fechado.");
        }
        if (aFechar.isEmpty() || !aFechar.get().equals(mes)) {
            throw new RegraDeNegocioException("PERIODO_FORA_DE_ORDEM", aFechar
                    .map(m -> "Os meses são fechados em ordem: feche antes " + MES.format(m) + ".")
                    .orElse("O mês de " + MES.format(mes) + " já está fechado."));
        }
    }

    public static void exigirUltimoFechado(YearMonth mes, Optional<YearMonth> ultimo) {
        if (ultimo.isEmpty() || !ultimo.get().equals(mes)) {
            throw new RegraDeNegocioException("REABERTURA_FORA_DE_ORDEM", ultimo
                    .map(m -> "Só o mês fechado mais recente (" + MES.format(m) + ") pode ser reaberto.")
                    .orElse("Nenhum mês está fechado."));
        }
    }
}
