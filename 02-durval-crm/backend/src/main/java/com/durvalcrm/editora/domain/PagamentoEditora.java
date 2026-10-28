package com.durvalcrm.editora.domain;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Pagamento (parcial ou total) a uma editora (US-PUBLISHER-008). O valor vai para as obrigações
 * abertas da mais antiga para a mais nova; o crédito disponível da editora (pagamentos de obrigações
 * depois estornadas) é aplicado antes, sem sair dinheiro. Corrige-se só pelo estorno da despesa no
 * Financeiro (US-FINANCIAL-010), que reabre as obrigações cobertas.
 */
public final class PagamentoEditora {

    public static final int MAXIMO_OBSERVACAO = 500;

    private final Long id;
    private final long editoraId;
    private final LocalDate pagoEm;
    private final BigDecimal valor;
    private final BigDecimal creditoAplicado;
    private final long contaId;
    private final String contaNome;
    private final MeioPagamentoEditora meio;
    private final String observacao;
    private Long lancamentoId;
    private final String chaveIdempotencia;
    private final Instant registradoEm;
    private final String registradoPorSubject;
    private final String registradoPor;
    private Instant estornadoEm;
    private final List<Alocacao> alocacoes;

    private PagamentoEditora(Long id, long editoraId, LocalDate pagoEm, BigDecimal valor, BigDecimal creditoAplicado,
            long contaId, String contaNome, MeioPagamentoEditora meio, String observacao, Long lancamentoId,
            String chaveIdempotencia, Instant registradoEm, String registradoPorSubject, String registradoPor,
            Instant estornadoEm, List<Alocacao> alocacoes) {
        this.id = id;
        this.editoraId = editoraId;
        this.pagoEm = Objects.requireNonNull(pagoEm);
        this.valor = Objects.requireNonNull(valor);
        this.creditoAplicado = Objects.requireNonNull(creditoAplicado);
        this.contaId = contaId;
        this.contaNome = Objects.requireNonNull(contaNome);
        this.meio = Objects.requireNonNull(meio);
        this.observacao = observacao;
        this.lancamentoId = lancamentoId;
        this.chaveIdempotencia = Objects.requireNonNull(chaveIdempotencia);
        this.registradoEm = Objects.requireNonNull(registradoEm);
        this.registradoPorSubject = Objects.requireNonNull(registradoPorSubject);
        this.registradoPor = registradoPor;
        this.estornadoEm = estornadoEm;
        this.alocacoes = List.copyOf(alocacoes);
    }

    /** Saldo devido = em aberto nas obrigações − crédito disponível (pode ser negativo: crédito). */
    public static BigDecimal saldoDevido(List<Obrigacao> abertas, BigDecimal credito) {
        return emAberto(abertas).subtract(credito);
    }

    /** Distribui {@code total} pelas obrigações na ordem recebida (da mais antiga para a mais nova). */
    public static List<Alocacao> alocar(List<Obrigacao> abertas, BigDecimal total) {
        List<Alocacao> alocacoes = new ArrayList<>();
        BigDecimal resta = total;
        for (Obrigacao o : abertas) {
            if (resta.signum() <= 0) {
                break;
            }
            BigDecimal parte = resta.min(o.getValorAberto());
            if (parte.signum() > 0) {
                alocacoes.add(new Alocacao(o.getId(), parte));
                resta = resta.subtract(parte);
            }
        }
        return alocacoes;
    }

    /** Crédito usado antes do dinheiro: tudo o que houver, até o total em aberto. */
    public static BigDecimal creditoAplicavel(List<Obrigacao> abertas, BigDecimal credito) {
        return credito.signum() <= 0 ? BigDecimal.ZERO : credito.min(emAberto(abertas));
    }

    /** {@code abertas}: travadas, da mais antiga para a mais nova. Aplica as alocações nelas. */
    public static PagamentoEditora novo(long editoraId, LocalDate data, LocalDate hoje, BigDecimal valor,
            ContaFinanceira conta, MeioPagamentoEditora meio, String observacao, String chave, List<Obrigacao> abertas,
            BigDecimal credito, String subject, String autor, Instant agora) {
        BigDecimal saldo = saldoDevido(abertas, credito);
        if (saldo.signum() <= 0) {
            throw new RegraDeNegocioException("SEM_SALDO_DEVIDO", "Não há saldo devido a esta editora.");
        }
        List<ErroCampo> erros = new ArrayList<>();
        if (valor == null || valor.signum() <= 0) {
            erros.add(new ErroCampo("valor", "Informe um valor maior que zero."));
        } else if (valor.stripTrailingZeros().scale() > 2) {
            erros.add(new ErroCampo("valor", "Use no máximo duas casas decimais."));
        } else if (valor.compareTo(saldo) > 0) {
            erros.add(new ErroCampo("valor", "O valor passa o saldo devido de " + Dinheiro.brl(saldo) + "."));
        }
        if (meio == null) {
            erros.add(new ErroCampo("meio", "Escolha o meio de pagamento."));
        }
        if (conta == null || !conta.ativa()) {
            erros.add(new ErroCampo("contaId", "Escolha a conta de origem."));
        } else if (meio != null && (meio.saiDoCaixa() ? conta.tipo() != TipoConta.CAIXA : conta.tipo() != TipoConta.BANCO)) {
            erros.add(new ErroCampo("contaId", meio.saiDoCaixa()
                    ? "Pagamento em dinheiro sai de um caixa."
                    : "PIX e transferência saem de uma conta bancária."));
        }
        if (data == null) {
            erros.add(new ErroCampo("pagoEm", "Informe a data do pagamento."));
        } else if (data.isAfter(hoje)) {
            erros.add(new ErroCampo("pagoEm", "A data do pagamento não pode ser futura."));
        }
        String texto = Textos.compactar(observacao);
        if (texto.length() > MAXIMO_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "Use até 500 caracteres."));
        }
        if (Textos.vazio(chave)) {
            erros.add(new ErroCampo("chaveIdempotencia", "Requisição sem chave de idempotência."));
        }
        ValidacaoException.lancarSeHouver(erros);
        BigDecimal creditoAplicado = creditoAplicavel(abertas, credito);
        List<Alocacao> alocacoes = alocar(abertas, valor.add(creditoAplicado));
        for (Alocacao a : alocacoes) {
            abertas.stream().filter(o -> o.getId() == a.obrigacaoId()).findFirst().orElseThrow().pagar(a.valor());
        }
        return new PagamentoEditora(null, editoraId, data, valor, creditoAplicado, conta.id(), conta.nome(), meio,
                texto.isEmpty() ? null : texto, null, chave.trim(), agora, subject, autor, null, alocacoes);
    }

    public static PagamentoEditora reconstituir(Long id, long editoraId, LocalDate pagoEm, BigDecimal valor,
            BigDecimal creditoAplicado, long contaId, String contaNome, MeioPagamentoEditora meio, String observacao,
            Long lancamentoId, String chaveIdempotencia, Instant registradoEm, String registradoPorSubject,
            String registradoPor, Instant estornadoEm, List<Alocacao> alocacoes) {
        return new PagamentoEditora(id, editoraId, pagoEm, valor, creditoAplicado, contaId, contaNome, meio,
                observacao, lancamentoId, chaveIdempotencia, registradoEm, registradoPorSubject, registradoPor,
                estornadoEm, alocacoes);
    }

    private static BigDecimal emAberto(List<Obrigacao> abertas) {
        return abertas.stream().map(Obrigacao::getValorAberto).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void registrarLancamento(long id) {
        lancamentoId = id;
    }

    /** A despesa foi estornada no Financeiro; o chamador reabre as obrigações cobertas. */
    public void estornar(Instant agora) {
        if (estornadoEm != null) {
            throw new IllegalStateException("Pagamento já estornado.");
        }
        estornadoEm = agora;
    }

    public boolean estornado() {
        return estornadoEm != null;
    }

    public Long getId() { return id; }
    public long getEditoraId() { return editoraId; }
    public LocalDate getPagoEm() { return pagoEm; }
    public BigDecimal getValor() { return valor; }
    public BigDecimal getCreditoAplicado() { return creditoAplicado; }
    public long getContaId() { return contaId; }
    public String getContaNome() { return contaNome; }
    public MeioPagamentoEditora getMeio() { return meio; }
    public String getObservacao() { return observacao; }
    public Long getLancamentoId() { return lancamentoId; }
    public String getChaveIdempotencia() { return chaveIdempotencia; }
    public Instant getRegistradoEm() { return registradoEm; }
    public String getRegistradoPorSubject() { return registradoPorSubject; }
    public String getRegistradoPor() { return registradoPor; }
    public Instant getEstornadoEm() { return estornadoEm; }
    public List<Alocacao> getAlocacoes() { return alocacoes; }
}
