package com.durvalcrm.intencaogasto.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface IntencaoGastoRepository {

    /** Insere (sem id) ou atualiza situação, decisão e itens; grava os eventos novos no histórico. */
    IntencaoGasto salvar(IntencaoGasto intencao);

    Optional<IntencaoGasto> obter(long id);

    /** Trava a intenção ({@code SELECT … FOR UPDATE}) até o fim da transação: decisões nunca concorrem. */
    Optional<IntencaoGasto> travar(long id);

    /** Os anexos só são gravados na criação; depois disso não mudam. */
    void salvarAnexos(long intencaoId, List<AnexoIntencao> anexos, Instant em);
}
