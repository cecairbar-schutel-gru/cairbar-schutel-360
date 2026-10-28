package com.durvalcrm.financeiro.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;

/**
 * Transação financeira com linhas por conta e por categoria (US-FINANCIAL-001). A soma das
 * linhas de conta é igual à soma das linhas de categoria (receita positiva, despesa negativa);
 * transferências não têm categoria e suas linhas de conta somam zero. Lançamentos nunca são
 * editados nem excluídos: correções são feitas por estorno.
 */
public final class Lancamento {

    private final Long id;
    private final LocalDate dataFinanceira;
    private final String origemTipo;
    private final Long origemId;
    private final String descricao;
    private final String criadoPor;
    private final String criadoPorNome;
    private final Instant criadoEm;
    private final Long estornaLancamentoId;
    private final Long corrigeLancamentoId;
    private final String motivo;
    private final String referenciaExterna;
    private final String chaveIdempotencia;
    private final List<LinhaConta> linhasConta;
    private final List<LinhaCategoria> linhasCategoria;

    private Lancamento(Long id, LocalDate dataFinanceira, String origemTipo, Long origemId, String descricao,
            String criadoPor, String criadoPorNome, Instant criadoEm, Long estornaLancamentoId,
            Long corrigeLancamentoId, String motivo, String referenciaExterna, String chaveIdempotencia,
            List<LinhaConta> linhasConta, List<LinhaCategoria> linhasCategoria) {
        this.id = id;
        this.dataFinanceira = Objects.requireNonNull(dataFinanceira);
        this.origemTipo = Objects.requireNonNull(origemTipo);
        this.origemId = origemId;
        this.descricao = Objects.requireNonNull(descricao);
        this.criadoPor = Objects.requireNonNull(criadoPor);
        this.criadoPorNome = criadoPorNome;
        this.criadoEm = Objects.requireNonNull(criadoEm);
        this.estornaLancamentoId = estornaLancamentoId;
        this.corrigeLancamentoId = corrigeLancamentoId;
        this.motivo = motivo;
        this.referenciaExterna = referenciaExterna;
        this.chaveIdempotencia = chaveIdempotencia;
        this.linhasConta = List.copyOf(linhasConta);
        this.linhasCategoria = List.copyOf(linhasCategoria);
    }

    public static Lancamento novo(LocalDate dataFinanceira, String origemTipo, Long origemId, String descricao,
            Autor autor, List<LinhaConta> linhasConta, List<LinhaCategoria> linhasCategoria,
            Complemento complemento) {
        if (linhasConta.isEmpty()) {
            throw new IllegalArgumentException("Lançamento sem linhas de conta.");
        }
        if (linhasConta.stream().anyMatch(l -> l.valor().signum() == 0)
                || linhasCategoria.stream().anyMatch(l -> l.valor().signum() == 0)) {
            throw new IllegalArgumentException("Linhas de lançamento não podem ter valor zero.");
        }
        if (soma(linhasConta.stream().map(LinhaConta::valor).toList())
                .compareTo(soma(linhasCategoria.stream().map(LinhaCategoria::valor).toList())) != 0) {
            throw new IllegalArgumentException("A soma das contas difere da soma das categorias.");
        }
        Complemento c = complemento == null ? Complemento.NENHUM : complemento;
        return new Lancamento(null, dataFinanceira, origemTipo, origemId, descricao, autor.subject(), autor.nome(),
                autor.em(), null, c.corrigeLancamentoId(), null, c.referenciaExterna(), c.chaveIdempotencia(),
                linhasConta, linhasCategoria);
    }

    public static Lancamento reconstituir(Long id, LocalDate dataFinanceira, String origemTipo, Long origemId,
            String descricao, String criadoPor, String criadoPorNome, Instant criadoEm, Long estornaLancamentoId,
            Long corrigeLancamentoId, String motivo, String referenciaExterna, String chaveIdempotencia,
            List<LinhaConta> linhasConta, List<LinhaCategoria> linhasCategoria) {
        return new Lancamento(id, dataFinanceira, origemTipo, origemId, descricao, criadoPor, criadoPorNome,
                criadoEm, estornaLancamentoId, corrigeLancamentoId, motivo, referenciaExterna, chaveIdempotencia,
                linhasConta, linhasCategoria);
    }

    /** Lançamento inverso: cada linha de conta e de categoria com o sinal trocado. */
    public Lancamento estorno(LocalDate data, String descricaoEstorno, String motivoEstorno, Autor autor) {
        if (estornaLancamentoId != null) {
            throw new IllegalStateException("Um estorno não pode ser estornado.");
        }
        return new Lancamento(null, data, origemTipo, origemId, descricaoEstorno, autor.subject(), autor.nome(),
                autor.em(), id, null, motivoEstorno, null, null,
                linhasConta.stream().map(l -> new LinhaConta(l.contaId(), l.valor().negate(), l.tipoCartao())).toList(),
                linhasCategoria.stream().map(l -> new LinhaCategoria(l.categoria(), l.valor().negate())).toList());
    }

    public NaturezaLancamento natureza() {
        if (estornaLancamentoId != null) {
            return NaturezaLancamento.ESTORNO;
        }
        if (OrigemLancamento.LIQUIDACAO_CARTAO.equals(origemTipo)) {
            return NaturezaLancamento.LIQUIDACAO;
        }
        if (linhasCategoria.isEmpty()) {
            return NaturezaLancamento.TRANSFERENCIA;
        }
        return soma(linhasCategoria.stream().map(LinhaCategoria::valor).toList()).signum() > 0
                ? NaturezaLancamento.RECEITA
                : NaturezaLancamento.DESPESA;
    }

    /** Movimento líquido da conta neste lançamento (zero se ela não participa). */
    public BigDecimal valorNaConta(long contaId) {
        return soma(linhasConta.stream().filter(l -> l.contaId() == contaId).map(LinhaConta::valor).toList());
    }

    private static BigDecimal soma(List<BigDecimal> valores) {
        return valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Long getId() { return id; }
    public LocalDate getDataFinanceira() { return dataFinanceira; }
    public String getOrigemTipo() { return origemTipo; }
    public Long getOrigemId() { return origemId; }
    public String getDescricao() { return descricao; }
    public String getCriadoPor() { return criadoPor; }
    public String getCriadoPorNome() { return criadoPorNome; }
    public Instant getCriadoEm() { return criadoEm; }
    public Long getEstornaLancamentoId() { return estornaLancamentoId; }
    public Long getCorrigeLancamentoId() { return corrigeLancamentoId; }
    public String getMotivo() { return motivo; }
    public String getReferenciaExterna() { return referenciaExterna; }
    public String getChaveIdempotencia() { return chaveIdempotencia; }
    public List<LinhaConta> getLinhasConta() { return linhasConta; }
    public List<LinhaCategoria> getLinhasCategoria() { return linhasCategoria; }

    /** Quem registrou e quando. */
    public record Autor(String subject, String nome, Instant em) {

        public Autor {
            Objects.requireNonNull(subject);
            Objects.requireNonNull(em);
        }
    }

    /** Dados opcionais: lançamento que este corrige, referência externa e chave de idempotência. */
    public record Complemento(Long corrigeLancamentoId, String referenciaExterna, String chaveIdempotencia) {

        public static final Complemento NENHUM = new Complemento(null, null, null);
    }
}
