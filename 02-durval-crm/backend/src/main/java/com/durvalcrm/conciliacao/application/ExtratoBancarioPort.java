package com.durvalcrm.conciliacao.application;

import com.durvalcrm.conciliacao.domain.ExtratoBancario.Formato;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.LinhaNova;
import com.durvalcrm.financeiro.domain.Lancamento;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Extrato importado na sessão: o arquivo, as linhas e o par confirmado de cada uma. */
public interface ExtratoBancarioPort {

    /** Substitui o extrato da sessão (as linhas antigas e seus pares saem; as marcações ficam). */
    void substituir(long conciliacaoId, String arquivo, Formato formato, List<LinhaNova> linhas, Lancamento.Autor autor);

    Optional<ExtratoImportado> buscar(long conciliacaoId);

    /** Liga a linha ao lançamento (par confirmado). */
    void ligar(long conciliacaoId, long linhaId, long lancamentoId, Lancamento.Autor autor);

    /** Desfaz o par da linha; devolve o lançamento que estava ligado. */
    Optional<Long> desligar(long conciliacaoId, long linhaId);

    /** Desfaz os pares cujo lançamento não está mais marcado na sessão; devolve quantos. */
    int desligarNaoMarcados(long conciliacaoId);

    record ExtratoImportado(String arquivo, Formato formato, String importadoPor, Instant importadoEm,
            List<LinhaExtrato> linhas) {
    }

    /** @param lancamentoId par confirmado (nulo se ainda sem par) */
    record LinhaExtrato(long id, LocalDate data, String descricao, BigDecimal valor, String identificador,
            Long lancamentoId, String conferidaPor, Instant conferidaEm) {
    }
}
