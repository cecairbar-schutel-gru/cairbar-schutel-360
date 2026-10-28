package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "competencia")
public class CompetenciaJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doador_id", nullable = false)
    private long doadorId;

    /** Primeiro dia do mês da competência. */
    @Column(nullable = false)
    private LocalDate mes;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusCompetencia status;

    @Column(name = "data_pagamento")
    private LocalDate dataPagamento;

    @Column(name = "numero_recibo")
    private String numeroRecibo;

    @Column(name = "contribuicao_id")
    private Long contribuicaoId;

    @Column(name = "criada_no_pagamento", nullable = false)
    private boolean criadaNoPagamento;

    protected CompetenciaJpaEntity() {
    }

    CompetenciaJpaEntity(Long id, long doadorId, LocalDate mes, BigDecimal valor, StatusCompetencia status,
            LocalDate dataPagamento, String numeroRecibo, Long contribuicaoId, boolean criadaNoPagamento) {
        this.id = id;
        this.doadorId = doadorId;
        this.mes = mes;
        this.valor = valor;
        this.status = status;
        this.dataPagamento = dataPagamento;
        this.numeroRecibo = numeroRecibo;
        this.contribuicaoId = contribuicaoId;
        this.criadaNoPagamento = criadaNoPagamento;
    }

    Long getId() { return id; }
    long getDoadorId() { return doadorId; }
    LocalDate getMes() { return mes; }
    BigDecimal getValor() { return valor; }
    StatusCompetencia getStatus() { return status; }
    LocalDate getDataPagamento() { return dataPagamento; }
    String getNumeroRecibo() { return numeroRecibo; }
    Long getContribuicaoId() { return contribuicaoId; }
    boolean isCriadaNoPagamento() { return criadaNoPagamento; }
}
