package com.durvalcrm.fechamento.application;

import com.durvalcrm.fechamento.domain.Autor;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

/** Versões do demonstrativo e dos saldos gravadas a cada fechamento (US-CLOSING-008, 009). */
public interface SnapshotsPort {

    /** Grava a próxima versão do mês e devolve o número dela. */
    int gravar(YearMonth mes, Demonstrativo demonstrativo, Autor autor);

    Optional<Snapshot> ultima(YearMonth mes);

    Optional<Snapshot> versao(YearMonth mes, int versao);

    /** Da mais recente à mais antiga, sem o conteúdo. */
    List<VersaoSnapshot> versoes(YearMonth mes);

    record Snapshot(YearMonth mes, int versao, Demonstrativo demonstrativo, Autor autor) {
    }

    record VersaoSnapshot(int versao, Autor autor) {
    }
}
