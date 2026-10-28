package com.durvalcrm.contribuicao.adapter.out.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface SpringDataContribuicaoRepository extends JpaRepository<ContribuicaoJpaEntity, Long> {

    Optional<ContribuicaoJpaEntity> findByChaveIdempotencia(String chave);

    Optional<ContribuicaoJpaEntity> findByNumeroRecibo(String numero);

    List<ContribuicaoJpaEntity> findByDoadorIdAndDataFinanceiraBetweenOrderByRecebidaEmDescIdDesc(long doadorId,
            LocalDate inicio, LocalDate fim);

    @Query("""
            select distinct extract(year from c.dataFinanceira) from ContribuicaoJpaEntity c
            where c.doadorId = :doadorId order by 1 desc""")
    List<Integer> anos(long doadorId);

    List<ContribuicaoJpaEntity> findByDataFinanceiraAndOperadorSubject(LocalDate data, String operadorSubject);

    List<ContribuicaoJpaEntity> findByOperadorSubjectOrderByRecebidaEmDescIdDesc(String operadorSubject, Pageable pagina);
}
