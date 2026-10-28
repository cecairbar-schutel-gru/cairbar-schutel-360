package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.TipoConta;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

interface SpringDataContaFinanceiraRepository extends JpaRepository<ContaFinanceiraJpaEntity, Long> {

    List<ContaFinanceiraJpaEntity> findByTipoAndAtivaTrueOrderByNomeAsc(TipoConta tipo);

    ContaFinanceiraJpaEntity findFirstByTipo(TipoConta tipo);

    boolean existsByCodigo(String codigo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ContaFinanceiraJpaEntity c where c.id = :id")
    Optional<ContaFinanceiraJpaEntity> travar(long id);
}
