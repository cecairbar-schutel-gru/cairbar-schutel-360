package com.durvalcrm.venda.adapter.out.persistence;

import com.durvalcrm.venda.domain.StatusVenda;
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
@Table(name = "venda")
public class VendaJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private long numero;

    @Column(name = "vendedor_subject", nullable = false)
    private String vendedorSubject;

    @Column(name = "vendedor_nome")
    private String vendedorNome;

    @Column(nullable = false)
    private boolean pdv;

    @Column(name = "confirmada_em", nullable = false)
    private Instant confirmadaEm;

    @Column(name = "data_financeira", nullable = false)
    private LocalDate dataFinanceira;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(name = "chave_idempotencia", nullable = false)
    private String chaveIdempotencia;

    @Column(name = "refaz_venda_id")
    private Long refazVendaId;

    @Column(name = "lancamento_id")
    private Long lancamentoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusVenda status;

    @Column(name = "cancelada_em")
    private Instant canceladaEm;

    @Column(name = "cancelada_por")
    private String canceladaPor;

    @Column(name = "motivo_cancelamento")
    private String motivoCancelamento;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "venda_item", joinColumns = @JoinColumn(name = "venda_id"))
    @OrderColumn(name = "ordem")
    private List<ItemVendaEmbeddable> itens = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "venda_item_lote", joinColumns = @JoinColumn(name = "venda_id"))
    @OrderColumn(name = "ordem")
    private List<LoteVendidoEmbeddable> lotes = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "venda_pagamento", joinColumns = @JoinColumn(name = "venda_id"))
    @OrderColumn(name = "ordem")
    private List<PagamentoVendaEmbeddable> pagamentos = new ArrayList<>();

    protected VendaJpaEntity() {
    }

    /** Dados imutáveis da venda: gravados uma única vez. */
    VendaJpaEntity(long numero, String vendedorSubject, String vendedorNome, boolean pdv,
            Instant confirmadaEm, LocalDate dataFinanceira, BigDecimal total, String chaveIdempotencia,
            Long refazVendaId, List<ItemVendaEmbeddable> itens, List<PagamentoVendaEmbeddable> pagamentos) {
        this.numero = numero;
        this.vendedorSubject = vendedorSubject;
        this.vendedorNome = vendedorNome;
        this.pdv = pdv;
        this.confirmadaEm = confirmadaEm;
        this.dataFinanceira = dataFinanceira;
        this.total = total;
        this.chaveIdempotencia = chaveIdempotencia;
        this.refazVendaId = refazVendaId;
        this.itens = new ArrayList<>(itens);
        this.pagamentos = new ArrayList<>(pagamentos);
    }

    /** Lotes só são acrescentados durante a confirmação; depois mudam só o vínculo e o cancelamento. */
    void atualizarSituacao(List<LoteVendidoEmbeddable> novosLotes, Long lancamentoId, StatusVenda status,
            Instant canceladaEm, String canceladaPor, String motivoCancelamento) {
        if (novosLotes.size() > lotes.size()) {
            lotes.addAll(novosLotes.subList(lotes.size(), novosLotes.size()));
        }
        this.lancamentoId = lancamentoId;
        this.status = status;
        this.canceladaEm = canceladaEm;
        this.canceladaPor = canceladaPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    Long getId() { return id; }
    long getNumero() { return numero; }
    String getVendedorSubject() { return vendedorSubject; }
    String getVendedorNome() { return vendedorNome; }
    boolean isPdv() { return pdv; }
    Instant getConfirmadaEm() { return confirmadaEm; }
    LocalDate getDataFinanceira() { return dataFinanceira; }
    String getChaveIdempotencia() { return chaveIdempotencia; }
    Long getRefazVendaId() { return refazVendaId; }
    Long getLancamentoId() { return lancamentoId; }
    StatusVenda getStatus() { return status; }
    Instant getCanceladaEm() { return canceladaEm; }
    String getCanceladaPor() { return canceladaPor; }
    String getMotivoCancelamento() { return motivoCancelamento; }
    List<ItemVendaEmbeddable> getItens() { return itens; }
    List<LoteVendidoEmbeddable> getLotes() { return lotes; }
    List<PagamentoVendaEmbeddable> getPagamentos() { return pagamentos; }
}
