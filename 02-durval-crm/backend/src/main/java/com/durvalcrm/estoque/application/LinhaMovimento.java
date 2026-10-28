package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.TipoMovimento;
import java.time.Instant;

/** Linha do histórico (US-INVENTORY-010) com o saldo do produto logo após o movimento. */
public record LinhaMovimento(long id, Instant ocorridoEm, TipoMovimento tipo, int quantidade, Long remessaId,
        String remessaCodigo, String usuarioNome, String referenciaTipo, Long referenciaId, Long estornaMovimentoId,
        boolean estornado, int saldoApos) {
}
