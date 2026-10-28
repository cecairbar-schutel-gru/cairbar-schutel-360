package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.TipoConta;
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
@Table(name = "conta_financeira")
public class ContaFinanceiraJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String codigo;

    @Column(nullable = false)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoConta tipo;

    @Column(nullable = false)
    private boolean ativa;

    private String localizacao;

    private String banco;

    private String agencia;

    @Column(name = "numero_conta")
    private String numeroConta;

    @Column(name = "saldo_inicial", nullable = false, precision = 12, scale = 2)
    private BigDecimal saldoInicial;

    @Column(name = "data_corte", nullable = false)
    private LocalDate dataCorte;

    protected ContaFinanceiraJpaEntity() {
    }

    ContaFinanceiraJpaEntity(Long id, String codigo, String nome, TipoConta tipo, boolean ativa, String localizacao,
            String banco, String agencia, String numeroConta, BigDecimal saldoInicial, LocalDate dataCorte) {
        this.id = id;
        this.codigo = codigo;
        this.nome = nome;
        this.tipo = tipo;
        this.ativa = ativa;
        this.localizacao = localizacao;
        this.banco = banco;
        this.agencia = agencia;
        this.numeroConta = numeroConta;
        this.saldoInicial = saldoInicial;
        this.dataCorte = dataCorte;
    }

    Long getId() { return id; }
    String getCodigo() { return codigo; }
    String getNome() { return nome; }
    TipoConta getTipo() { return tipo; }
    boolean isAtiva() { return ativa; }
    String getLocalizacao() { return localizacao; }
    String getBanco() { return banco; }
    String getAgencia() { return agencia; }
    String getNumeroConta() { return numeroConta; }
    BigDecimal getSaldoInicial() { return saldoInicial; }
    LocalDate getDataCorte() { return dataCorte; }
}
