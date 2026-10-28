package com.durvalcrm.doador.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "doador_nota")
public class NotaDoadorJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "doador_id", nullable = false)
    private long doadorId;

    @Column(nullable = false, length = 500)
    private String texto;

    @Column(name = "autor_subject", nullable = false)
    private String autorSubject;

    @Column(name = "autor_nome")
    private String autorNome;

    @Column(name = "criada_em", nullable = false)
    private Instant criadaEm;

    protected NotaDoadorJpaEntity() {
    }

    NotaDoadorJpaEntity(long doadorId, String texto, String autorSubject, String autorNome, Instant criadaEm) {
        this.doadorId = doadorId;
        this.texto = texto;
        this.autorSubject = autorSubject;
        this.autorNome = autorNome;
        this.criadaEm = criadaEm;
    }

    Long getId() { return id; }
    long getDoadorId() { return doadorId; }
    String getTexto() { return texto; }
    String getAutorSubject() { return autorSubject; }
    String getAutorNome() { return autorNome; }
    Instant getCriadaEm() { return criadaEm; }
}
