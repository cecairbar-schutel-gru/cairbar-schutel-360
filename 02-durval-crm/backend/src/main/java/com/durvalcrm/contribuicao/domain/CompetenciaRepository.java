package com.durvalcrm.contribuicao.domain;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public interface CompetenciaRepository {

    void salvar(Competencia competencia);

    void salvarTodas(Collection<Competencia> competencias);

    boolean existe(long doadorId, YearMonth mes);

    Optional<Competencia> buscar(long doadorId, YearMonth mes);

    /** Ordenadas por mês, da mais antiga para a mais recente. */
    List<Competencia> listarPorDoador(long doadorId);

    List<Competencia> listarPendentes(long doadorId);

    List<Competencia> listarPorContribuicao(long contribuicaoId);

    /** Quantidade de competências pendentes por doador; doadores sem pendências ficam fora do mapa. */
    Map<Long, Long> contarPendentesPorDoador(Collection<Long> doadorIds);

    /** Doadores que já têm competência no mês (geração idempotente, US-CONTRIB-001). */
    Set<Long> doadoresComCompetencia(YearMonth mes);

    /**
     * Marca como paga somente se ainda estiver pendente (update condicional).
     *
     * @return {@code false} se outra operação pagou ou cancelou a competência antes
     */
    boolean marcarComoPaga(long competenciaId, long contribuicaoId, LocalDate dataPagamento, String numeroRecibo);

    /**
     * Insere uma competência antecipada já paga.
     *
     * @return {@code false} se o mês já existir para o doador (pagamento concorrente)
     */
    boolean inserirPaga(Competencia competencia);

    /** Estorno: volta a Pendente, sem data de pagamento, recibo nem contribuição. */
    void reabrir(long competenciaId);

    void excluir(long competenciaId);
}
