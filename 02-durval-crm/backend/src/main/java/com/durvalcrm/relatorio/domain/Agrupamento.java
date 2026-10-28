package com.durvalcrm.relatorio.domain;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;

/** Linhas do fluxo de caixa (US-REPORT-001): por dia, por semana (de segunda a domingo) ou por mês. */
public enum Agrupamento {
    DIA,
    SEMANA,
    MES;

    /** Intervalos que cobrem o período; o primeiro e o último são cortados nas pontas dele. */
    public List<Intervalo> intervalos(PeriodoRelatorio periodo) {
        List<Intervalo> lista = new ArrayList<>();
        LocalDate inicio = periodo.de();
        while (!inicio.isAfter(periodo.ate())) {
            LocalDate fim = switch (this) {
                case DIA -> inicio;
                case SEMANA -> inicio.with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY));
                case MES -> inicio.with(TemporalAdjusters.lastDayOfMonth());
            };
            if (fim.isAfter(periodo.ate())) {
                fim = periodo.ate();
            }
            lista.add(new Intervalo(inicio, fim));
            inicio = fim.plusDays(1);
        }
        return lista;
    }

    public record Intervalo(LocalDate inicio, LocalDate fim) {
        public boolean contem(LocalDate data) {
            return !data.isBefore(inicio) && !data.isAfter(fim);
        }
    }
}
