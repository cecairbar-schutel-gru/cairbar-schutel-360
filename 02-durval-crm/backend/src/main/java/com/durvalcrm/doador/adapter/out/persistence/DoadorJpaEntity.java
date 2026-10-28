package com.durvalcrm.doador.adapter.out.persistence;

import com.durvalcrm.doador.domain.StatusDoador;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.MapKeyEnumerated;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "doador")
public class DoadorJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private long versao;

    @Column(nullable = false)
    private String nome;

    /** Nome sem acentos e em minúsculas, indexado por trigramas para busca e duplicidade. */
    @Column(name = "nome_busca", nullable = false)
    private String nomeBusca;

    private String cpf;

    @Column(name = "data_nascimento")
    private LocalDate dataNascimento;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusDoador status;

    @Embedded
    private EnderecoEmbeddable endereco;

    @ElementCollection
    @CollectionTable(name = "doador_contato", joinColumns = @JoinColumn(name = "doador_id"))
    @OrderColumn(name = "ordem")
    @BatchSize(size = 100)
    private List<ContatoEmbeddable> contatos = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "doador_consentimento", joinColumns = @JoinColumn(name = "doador_id"))
    @MapKeyEnumerated(EnumType.STRING)
    @MapKeyColumn(name = "canal")
    @BatchSize(size = 100)
    private Map<ConsentimentoEmbeddable.Canal, ConsentimentoEmbeddable> consentimentos =
            new EnumMap<>(ConsentimentoEmbeddable.Canal.class);

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "inativado_em")
    private Instant inativadoEm;

    @Column(name = "motivo_inativacao")
    private String motivoInativacao;

    protected DoadorJpaEntity() {
    }

    DoadorJpaEntity(Instant criadoEm) {
        this.criadoEm = criadoEm;
    }

    void atualizar(String nome, String nomeBusca, String cpf, LocalDate dataNascimento, StatusDoador status,
            EnderecoEmbeddable endereco, List<ContatoEmbeddable> contatos,
            Map<ConsentimentoEmbeddable.Canal, ConsentimentoEmbeddable> consentimentos, Instant inativadoEm,
            String motivoInativacao) {
        this.nome = nome;
        this.nomeBusca = nomeBusca;
        this.cpf = cpf;
        this.dataNascimento = dataNascimento;
        this.status = status;
        this.endereco = endereco;
        this.contatos.clear();
        this.contatos.addAll(contatos);
        this.consentimentos.clear();
        this.consentimentos.putAll(consentimentos);
        this.inativadoEm = inativadoEm;
        this.motivoInativacao = motivoInativacao;
    }

    Long getId() { return id; }
    String getNome() { return nome; }
    String getCpf() { return cpf; }
    LocalDate getDataNascimento() { return dataNascimento; }
    StatusDoador getStatus() { return status; }
    EnderecoEmbeddable getEndereco() { return endereco; }
    List<ContatoEmbeddable> getContatos() { return contatos; }
    Map<ConsentimentoEmbeddable.Canal, ConsentimentoEmbeddable> getConsentimentos() { return consentimentos; }
    Instant getCriadoEm() { return criadoEm; }
    Instant getInativadoEm() { return inativadoEm; }
    String getMotivoInativacao() { return motivoInativacao; }
}
