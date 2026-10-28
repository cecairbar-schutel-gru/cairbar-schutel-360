package com.durvalcrm.editora.domain;

import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

public interface TransferenciaSaldoRepository {

    TransferenciaSaldo salvar(TransferenciaSaldo transferencia);

    Optional<TransferenciaSaldo> obter(long editoraId, YearMonth mes);

    List<TransferenciaSaldo> doMes(YearMonth mes);
}
