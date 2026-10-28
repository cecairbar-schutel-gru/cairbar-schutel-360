package com.durvalcrm.contribuicao.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/**
 * Recebimento de mensalidades e/ou doação (Jornada A). A soma dos meios de pagamento é igual ao
 * total das competências mais a doação; o excedente nunca fica sem classificação (US-CONTRIB-004).
 * Cancelar preserva o registro original (US-CONTRIB-011).
 */
public final class Contribuicao {

    public static final int LIMITE_OBSERVACAO = 200;
    public static final int MINIMO_MOTIVO_CANCELAMENTO = 10;

    private final Long id;
    private final Long doadorId;
    private final boolean anonima;
    private final List<CompetenciaPaga> competencias;
    private final BigDecimal valorDoacao;
    private final List<Pagamento> pagamentos;
    private final String observacao;
    private final String operadorSubject;
    private final String operadorNome;
    private final Instant recebidaEm;
    private final LocalDate dataFinanceira;
    private final String numeroRecibo;
    private final String chaveIdempotencia;
    private Long lancamentoId;
    private StatusContribuicao status;
    private Instant canceladaEm;
    private String canceladaPor;
    private String motivoCancelamento;

    private Contribuicao(Long id, Recebimento r, String operadorSubject, String operadorNome, Instant recebidaEm,
            LocalDate dataFinanceira, String numeroRecibo, String chaveIdempotencia, Long lancamentoId,
            StatusContribuicao status, Instant canceladaEm, String canceladaPor, String motivoCancelamento) {
        this.id = id;
        this.doadorId = r.doadorId();
        this.anonima = r.anonima();
        this.competencias = r.competencias();
        this.valorDoacao = r.valorDoacao();
        this.pagamentos = r.pagamentos();
        this.observacao = r.observacao();
        this.operadorSubject = Objects.requireNonNull(operadorSubject);
        this.operadorNome = operadorNome;
        this.recebidaEm = Objects.requireNonNull(recebidaEm);
        this.dataFinanceira = Objects.requireNonNull(dataFinanceira);
        this.numeroRecibo = Objects.requireNonNull(numeroRecibo);
        this.chaveIdempotencia = chaveIdempotencia;
        this.lancamentoId = lancamentoId;
        this.status = Objects.requireNonNull(status);
        this.canceladaEm = canceladaEm;
        this.canceladaPor = canceladaPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    /**
     * Valida o recebimento e só então pede o número do recibo, para não consumir a sequência
     * anual com uma contribuição inválida.
     */
    public static Contribuicao registrar(Recebimento r, String operadorSubject, String operadorNome, Instant agora,
            LocalDate dataFinanceira, String chaveIdempotencia, Supplier<String> proximoRecibo) {
        validar(r);
        String observacao = Textos.vazio(r.observacao()) ? null : r.observacao().trim();
        Recebimento normalizado = new Recebimento(r.doadorId(), r.anonima(), r.competencias(), r.valorDoacao(),
                r.pagamentos(), observacao);
        return new Contribuicao(null, normalizado, operadorSubject, operadorNome, agora, dataFinanceira,
                proximoRecibo.get(), chaveIdempotencia, null, StatusContribuicao.REGISTRADA, null, null, null);
    }

    public static Contribuicao reconstituir(Long id, Recebimento r, String operadorSubject, String operadorNome,
            Instant recebidaEm, LocalDate dataFinanceira, String numeroRecibo, String chaveIdempotencia,
            Long lancamentoId, StatusContribuicao status, Instant canceladaEm, String canceladaPor,
            String motivoCancelamento) {
        return new Contribuicao(id, r, operadorSubject, operadorNome, recebidaEm, dataFinanceira, numeroRecibo,
                chaveIdempotencia, lancamentoId, status, canceladaEm, canceladaPor, motivoCancelamento);
    }

    private static void validar(Recebimento r) {
        if (r.anonima() && (r.doadorId() != null || !r.competencias().isEmpty())) {
            throw new IllegalArgumentException("Doação anônima não se vincula a doador nem a competência.");
        }
        if (!r.anonima() && r.doadorId() == null) {
            throw new IllegalArgumentException("Contribuição identificada exige o doador.");
        }
        List<ErroCampo> erros = new ArrayList<>();
        if (r.pagamentos().isEmpty()) {
            erros.add(new ErroCampo("pagamentos", "Informe o valor recebido em ao menos um meio de pagamento."));
        }
        if (r.pagamentos().stream().anyMatch(p -> !Valores.valido(p.valor()))) {
            erros.add(new ErroCampo("pagamentos", "Os valores devem ser positivos, com até duas casas decimais."));
        }
        if (contar(r, MeioPagamento.DINHEIRO) > 1 || contar(r, MeioPagamento.CARTAO) > 1) {
            erros.add(new ErroCampo("pagamentos", "Informe um único valor em dinheiro e um único valor em cartão."));
        }
        r.pagamentos().forEach(p -> TipoCartao.conferir(p.meio() == MeioPagamento.CARTAO, p.tipoCartao())
                .ifPresent(erros::add));
        if (r.valorDoacao().signum() < 0 || r.valorDoacao().stripTrailingZeros().scale() > 2) {
            erros.add(new ErroCampo("valorDoacao", "A doação deve ser positiva, com até duas casas decimais."));
        }
        if (r.observacao() != null && r.observacao().trim().length() > LIMITE_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "A observação deve ter até " + LIMITE_OBSERVACAO + " caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);

        BigDecimal recebido = Valores.soma(r.pagamentos().stream().map(Pagamento::valor).toList());
        BigDecimal devido = Valores.soma(r.competencias().stream().map(CompetenciaPaga::valor).toList());
        BigDecimal excedente = recebido.subtract(devido);
        if (excedente.signum() < 0) {
            throw ValidacaoException.doCampo("pagamentos", "Faltam " + Valores.brl(excedente.negate())
                    + " no valor recebido. Remova uma competência ou ajuste os valores.");
        }
        int comparacao = excedente.compareTo(r.valorDoacao());
        if (comparacao > 0) {
            throw ValidacaoException.doCampo("valorDoacao", "Há " + Valores.brl(excedente.subtract(r.valorDoacao()))
                    + " de excedente sem classificação. Classifique-o como doação extraordinária ou corrija os valores.");
        }
        if (comparacao < 0) {
            throw ValidacaoException.doCampo("valorDoacao", "A doação informada é maior que o excedente de "
                    + Valores.brl(excedente) + ".");
        }
    }

    private static long contar(Recebimento r, MeioPagamento meio) {
        return r.pagamentos().stream().filter(p -> p.meio() == meio).count();
    }

    public void vincularLancamento(long lancamentoId) {
        if (this.lancamentoId != null) {
            throw new IllegalStateException("Contribuição já lançada no financeiro.");
        }
        this.lancamentoId = lancamentoId;
    }

    /** O original permanece, com quem cancelou, quando e por quê (US-CONTRIB-011). */
    public void cancelar(String motivo, String autor, Instant agora) {
        if (status == StatusContribuicao.CANCELADA) {
            throw new RegraDeNegocioException("CONTRIBUICAO_JA_CANCELADA", "Esta contribuição já foi cancelada.");
        }
        if (motivo == null || motivo.trim().length() < MINIMO_MOTIVO_CANCELAMENTO) {
            throw ValidacaoException.doCampo("motivo",
                    "Informe o motivo com pelo menos " + MINIMO_MOTIVO_CANCELAMENTO + " caracteres.");
        }
        status = StatusContribuicao.CANCELADA;
        canceladaEm = agora;
        canceladaPor = autor;
        motivoCancelamento = motivo.trim();
    }

    public TipoContribuicao getTipo() {
        if (anonima) {
            return TipoContribuicao.DOACAO_ANONIMA;
        }
        return competencias.isEmpty() ? TipoContribuicao.DOACAO_EXTRAORDINARIA : TipoContribuicao.MENSALIDADE;
    }

    public BigDecimal totalCompetencias() {
        return Valores.soma(competencias.stream().map(CompetenciaPaga::valor).toList());
    }

    public BigDecimal total() {
        return Valores.soma(pagamentos.stream().map(Pagamento::valor).toList());
    }

    public BigDecimal valorPorMeio(MeioPagamento meio) {
        return Valores.soma(pagamentos.stream().filter(p -> p.meio() == meio).map(Pagamento::valor).toList());
    }

    public boolean isCancelada() {
        return status == StatusContribuicao.CANCELADA;
    }

    public Recebimento recebimento() {
        return new Recebimento(doadorId, anonima, competencias, valorDoacao, pagamentos, observacao);
    }

    public Long getId() { return id; }
    public Long getDoadorId() { return doadorId; }
    public boolean isAnonima() { return anonima; }
    public List<CompetenciaPaga> getCompetencias() { return competencias; }
    public BigDecimal getValorDoacao() { return valorDoacao; }
    public List<Pagamento> getPagamentos() { return pagamentos; }
    public String getObservacao() { return observacao; }
    public String getOperadorSubject() { return operadorSubject; }
    public String getOperadorNome() { return operadorNome; }
    public Instant getRecebidaEm() { return recebidaEm; }
    public LocalDate getDataFinanceira() { return dataFinanceira; }
    public String getNumeroRecibo() { return numeroRecibo; }
    public String getChaveIdempotencia() { return chaveIdempotencia; }
    public Long getLancamentoId() { return lancamentoId; }
    public StatusContribuicao getStatus() { return status; }
    public Instant getCanceladaEm() { return canceladaEm; }
    public String getCanceladaPor() { return canceladaPor; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
}
