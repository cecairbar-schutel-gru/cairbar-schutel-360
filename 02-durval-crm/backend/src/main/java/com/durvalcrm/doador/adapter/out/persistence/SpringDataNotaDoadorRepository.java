package com.durvalcrm.doador.adapter.out.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

interface SpringDataNotaDoadorRepository extends JpaRepository<NotaDoadorJpaEntity, Long> {

    List<NotaDoadorJpaEntity> findByDoadorIdOrderByCriadaEmDescIdDesc(long doadorId);

    @Modifying
    @Query("delete from NotaDoadorJpaEntity n where n.doadorId = :doadorId")
    void excluirPorDoador(long doadorId);
}
