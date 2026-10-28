package com.durvalcrm.venda.adapter.out.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface SpringDataVendaRepository extends JpaRepository<VendaJpaEntity, Long> {

    Optional<VendaJpaEntity> findByChaveIdempotencia(String chave);

    Optional<VendaJpaEntity> findByRefazVendaId(long vendaId);

    @Query("select v from VendaJpaEntity v where v.dataFinanceira = :data"
            + " and (v.vendedorSubject = :vendedor or v.pdv = true)")
    List<VendaJpaEntity> doDiaDoVendedorEDoPdv(LocalDate data, String vendedor);
}
