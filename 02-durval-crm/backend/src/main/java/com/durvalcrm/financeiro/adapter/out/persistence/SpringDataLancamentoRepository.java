package com.durvalcrm.financeiro.adapter.out.persistence;

import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

interface SpringDataLancamentoRepository extends JpaRepository<LancamentoJpaEntity, Long> {

    boolean existsByEstornaLancamentoId(long lancamentoId);

    Optional<LancamentoJpaEntity> findByChaveIdempotencia(String chave);

    /** Só a partir da data de corte: o histórico importado já está no saldo inicial. */
    @Query(value = """
            select coalesce(sum(lc.valor), 0) from lancamento_linha_conta lc
            join lancamento_financeiro l on l.id = lc.lancamento_id
            join conta_financeira c on c.id = lc.conta_id
            where lc.conta_id = :contaId and l.data_financeira >= c.data_corte""", nativeQuery = true)
    BigDecimal somaDasLinhas(long contaId);

    @Query("""
            select count(t) > 0 from LancamentoJpaEntity t join t.linhasConta l
            where l.contaId = :contaId""")
    boolean contaTemLancamentos(long contaId);
}
