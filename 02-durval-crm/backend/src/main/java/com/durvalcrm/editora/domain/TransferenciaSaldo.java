package com.durvalcrm.editora.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.util.Objects;

/**
 * Saldo devido levado conscientemente ao mês seguinte no fechamento (US-PUBLISHER-010). Não gera
 * lançamento: as obrigações continuam abertas, com as datas originais.
 */
public record TransferenciaSaldo(Long id, long editoraId, YearMonth mes, BigDecimal valor, String nota,
        String usuarioSubject, String usuarioNome, Instant registradaEm) {

    public static final int MAXIMO_NOTA = 500;

    public TransferenciaSaldo {
        Objects.requireNonNull(mes);
        Objects.requireNonNull(valor);
        Objects.requireNonNull(nota);
    }

    /** {@code saldo}: o saldo devido no último dia do mês. */
    public static TransferenciaSaldo nova(long editoraId, YearMonth mes, YearMonth atual, BigDecimal saldo,
            String nota, String subject, String nome, Instant agora) {
        if (mes == null) {
            throw ValidacaoException.doCampo("mes", "Informe o mês.");
        }
        if (mes.isAfter(atual)) {
            throw ValidacaoException.doCampo("mes", "O mês não pode ser futuro.");
        }
        String texto = Textos.compactar(nota);
        if (texto.isEmpty()) {
            throw ValidacaoException.doCampo("nota", "Explique a transferência (ex.: combinado com a editora pagar em 15/11).");
        }
        if (texto.length() > MAXIMO_NOTA) {
            throw ValidacaoException.doCampo("nota", "Use até 500 caracteres.");
        }
        if (saldo.signum() <= 0) {
            throw new RegraDeNegocioException("SEM_SALDO_DEVIDO", "A editora não tem saldo devido no fim do mês.");
        }
        return new TransferenciaSaldo(null, editoraId, mes, saldo, texto, subject, nome, agora);
    }
}
