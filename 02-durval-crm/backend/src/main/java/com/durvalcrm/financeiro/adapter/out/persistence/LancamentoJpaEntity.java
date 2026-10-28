package com.durvalcrm.financeiro.adapter.out.persistence;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "lancamento_financeiro")
public class LancamentoJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "data_financeira", nullable = false)
    private LocalDate dataFinanceira;

    @Column(name = "origem_tipo", nullable = false)
    private String origemTipo;

    @Column(name = "origem_id")
    private Long origemId;

    @Column(nullable = false)
    private String natureza;

    @Column(nullable = false)
    private String descricao;

    @Column(name = "criado_por", nullable = false)
    private String criadoPor;

    @Column(name = "criado_por_nome")
    private String criadoPorNome;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "estorna_lancamento_id")
    private Long estornaLancamentoId;

    @Column(name = "corrige_lancamento_id")
    private Long corrigeLancamentoId;

    private String motivo;

    @Column(name = "referencia_externa")
    private String referenciaExterna;

    @Column(name = "chave_idempotencia")
    private String chaveIdempotencia;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "lancamento_linha_conta", joinColumns = @JoinColumn(name = "lancamento_id"))
    @OrderColumn(name = "ordem")
    private List<LinhaContaEmbeddable> linhasConta = new ArrayList<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "lancamento_linha_categoria", joinColumns = @JoinColumn(name = "lancamento_id"))
    @OrderColumn(name = "ordem")
    private List<LinhaCategoriaEmbeddable> linhasCategoria = new ArrayList<>();

    protected LancamentoJpaEntity() {
    }

    LancamentoJpaEntity(LocalDate dataFinanceira, String origemTipo, Long origemId, String natureza,
            String descricao, String criadoPor, String criadoPorNome, Instant criadoEm, Long estornaLancamentoId,
            Long corrigeLancamentoId, String motivo, String referenciaExterna, String chaveIdempotencia,
            List<LinhaContaEmbeddable> linhasConta, List<LinhaCategoriaEmbeddable> linhasCategoria) {
        this.dataFinanceira = dataFinanceira;
        this.origemTipo = origemTipo;
        this.origemId = origemId;
        this.natureza = natureza;
        this.descricao = descricao;
        this.criadoPor = criadoPor;
        this.criadoPorNome = criadoPorNome;
        this.criadoEm = criadoEm;
        this.estornaLancamentoId = estornaLancamentoId;
        this.corrigeLancamentoId = corrigeLancamentoId;
        this.motivo = motivo;
        this.referenciaExterna = referenciaExterna;
        this.chaveIdempotencia = chaveIdempotencia;
        this.linhasConta = new ArrayList<>(linhasConta);
        this.linhasCategoria = new ArrayList<>(linhasCategoria);
    }

    Long getId() { return id; }
    LocalDate getDataFinanceira() { return dataFinanceira; }
    String getOrigemTipo() { return origemTipo; }
    Long getOrigemId() { return origemId; }
    String getDescricao() { return descricao; }
    String getCriadoPor() { return criadoPor; }
    String getCriadoPorNome() { return criadoPorNome; }
    Instant getCriadoEm() { return criadoEm; }
    Long getEstornaLancamentoId() { return estornaLancamentoId; }
    Long getCorrigeLancamentoId() { return corrigeLancamentoId; }
    String getMotivo() { return motivo; }
    String getReferenciaExterna() { return referenciaExterna; }
    String getChaveIdempotencia() { return chaveIdempotencia; }
    List<LinhaContaEmbeddable> getLinhasConta() { return linhasConta; }
    List<LinhaCategoriaEmbeddable> getLinhasCategoria() { return linhasCategoria; }
}
