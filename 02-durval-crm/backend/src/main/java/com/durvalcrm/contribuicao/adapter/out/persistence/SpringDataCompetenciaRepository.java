package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface SpringDataCompetenciaRepository extends JpaRepository<CompetenciaJpaEntity, Long> {

    boolean existsByDoadorIdAndMes(long doadorId, LocalDate mes);

    Optional<CompetenciaJpaEntity> findByDoadorIdAndMes(long doadorId, LocalDate mes);

    List<CompetenciaJpaEntity> findByDoadorIdOrderByMesAsc(long doadorId);

    List<CompetenciaJpaEntity> findByDoadorIdAndStatusOrderByMesAsc(long doadorId, StatusCompetencia status);

    List<CompetenciaJpaEntity> findByContribuicaoIdOrderByMesAsc(long contribuicaoId);

    @Query("""
            select c.doadorId, count(c) from CompetenciaJpaEntity c
            where c.doadorId in :doadorIds and c.status = :status
            group by c.doadorId""")
    List<Object[]> contarPorDoador(Collection<Long> doadorIds, StatusCompetencia status);

    @Query("select c.doadorId from CompetenciaJpaEntity c where c.mes = :mes")
    List<Long> doadoresDoMes(LocalDate mes);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update CompetenciaJpaEntity c
            set c.status = com.durvalcrm.contribuicao.domain.StatusCompetencia.PAGA, c.contribuicaoId = :contribuicaoId,
                c.dataPagamento = :data, c.numeroRecibo = :recibo
            where c.id = :id and c.status = com.durvalcrm.contribuicao.domain.StatusCompetencia.PENDENTE""")
    int pagarSePendente(long id, long contribuicaoId, LocalDate data, String recibo);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update CompetenciaJpaEntity c
            set c.status = com.durvalcrm.contribuicao.domain.StatusCompetencia.PENDENTE, c.contribuicaoId = null,
                c.dataPagamento = null, c.numeroRecibo = null, c.criadaNoPagamento = false
            where c.id = :id""")
    int reabrir(long id);
}
