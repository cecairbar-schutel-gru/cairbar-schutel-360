package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.domain.StatusContribuicao;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "contribuicao")
public class ContribuicaoJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoContribuicao tipo;

    @Column(name = "doador_id")
    private Long doadorId;

    @Column(name = "valor_doacao", nullable = false, precision = 12, scale = 2)
    private BigDecimal valorDoacao;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    private String observacao;

    @Column(name = "operador_subject", nullable = false)
    private String operadorSubject;

    @Column(name = "operador_nome")
    private String operadorNome;

    @Column(name = "recebida_em", nullable = false)
    private Instant recebidaEm;

    @Column(name = "data_financeira", nullable = false)
    private LocalDate dataFinanceira;

    @Column(name = "numero_recibo", nullable = false)
    private String numeroRecibo;

    @Column(name = "chave_idempotencia", nullable = false)
    private String chaveIdempotencia;

    @Column(name = "lancamento_id")
    private Long lancamentoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusContribuicao status;

    @Column(name = "cancelada_em")
    private Instant canceladaEm;

    @Column(name = "cancelada_por")
    private String canceladaPor;

    @Column(name = "motivo_cancelamento")
    private String motivoCancelamento;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "contribuicao_competencia", joinColumns = @JoinColumn(name = "contribuicao_id"))
    @OrderColumn(name = "ordem")
    private List<CompetenciaPagaEmbeddable> competencias = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "contribuicao_pagamento", joinColumns = @JoinColumn(name = "contribuicao_id"))
    @OrderColumn(name = "ordem")
    private List<PagamentoEmbeddable> pagamentos = new ArrayList<>();

    protected ContribuicaoJpaEntity() {
    }

    /** Dados imutáveis do recebimento: gravados uma única vez. */
    ContribuicaoJpaEntity(TipoContribuicao tipo, Long doadorId, BigDecimal valorDoacao, BigDecimal total,
            String observacao, String operadorSubject, String operadorNome,
            Instant recebidaEm, LocalDate dataFinanceira, String numeroRecibo, String chaveIdempotencia,
            List<CompetenciaPagaEmbeddable> competencias, List<PagamentoEmbeddable> pagamentos) {
        this.tipo = tipo;
        this.doadorId = doadorId;
        this.valorDoacao = valorDoacao;
        this.total = total;
        this.observacao = observacao;
        this.operadorSubject = operadorSubject;
        this.operadorNome = operadorNome;
        this.recebidaEm = recebidaEm;
        this.dataFinanceira = dataFinanceira;
        this.numeroRecibo = numeroRecibo;
        this.chaveIdempotencia = chaveIdempotencia;
        this.competencias = new ArrayList<>(competencias);
        this.pagamentos = new ArrayList<>(pagamentos);
    }

    /** Únicos campos que mudam depois do registro: vínculo financeiro e cancelamento. */
    void atualizarSituacao(Long lancamentoId, StatusContribuicao status, Instant canceladaEm, String canceladaPor,
            String motivoCancelamento) {
        this.lancamentoId = lancamentoId;
        this.status = status;
        this.canceladaEm = canceladaEm;
        this.canceladaPor = canceladaPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    Long getId() { return id; }
    TipoContribuicao getTipo() { return tipo; }
    Long getDoadorId() { return doadorId; }
    BigDecimal getValorDoacao() { return valorDoacao; }
    String getObservacao() { return observacao; }
    String getOperadorSubject() { return operadorSubject; }
    String getOperadorNome() { return operadorNome; }
    Instant getRecebidaEm() { return recebidaEm; }
    LocalDate getDataFinanceira() { return dataFinanceira; }
    String getNumeroRecibo() { return numeroRecibo; }
    String getChaveIdempotencia() { return chaveIdempotencia; }
    Long getLancamentoId() { return lancamentoId; }
    StatusContribuicao getStatus() { return status; }
    Instant getCanceladaEm() { return canceladaEm; }
    String getCanceladaPor() { return canceladaPor; }
    String getMotivoCancelamento() { return motivoCancelamento; }
    List<CompetenciaPagaEmbeddable> getCompetencias() { return competencias; }
    List<PagamentoEmbeddable> getPagamentos() { return pagamentos; }
}
