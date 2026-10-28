package com.durvalcrm.contribuicao.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Objects;

/**
 * Mensalidade devida por um doador em um mês. O valor é fixado na geração: mudanças da
 * mensalidade só valem para competências futuras, e o cancelamento preserva o valor original.
 * Competências futuras só existem depois de pagas antecipadamente (US-CONTRIB-003).
 */
public final class Competencia {

    private final Long id;
    private final long doadorId;
    private final YearMonth mes;
    private final BigDecimal valor;
    private StatusCompetencia status;
    private final LocalDate dataPagamento;
    private final String numeroRecibo;
    private final Long contribuicaoId;
    /** Criada já paga, por pagamento antecipado; volta a ser "futura" se a contribuição for cancelada. */
    private final boolean criadaNoPagamento;

    private Competencia(Long id, long doadorId, YearMonth mes, BigDecimal valor, StatusCompetencia status,
            LocalDate dataPagamento, String numeroRecibo, Long contribuicaoId, boolean criadaNoPagamento) {
        this.id = id;
        this.doadorId = doadorId;
        this.mes = Objects.requireNonNull(mes);
        this.valor = Objects.requireNonNull(valor);
        this.status = Objects.requireNonNull(status);
        this.dataPagamento = dataPagamento;
        this.numeroRecibo = numeroRecibo;
        this.contribuicaoId = contribuicaoId;
        this.criadaNoPagamento = criadaNoPagamento;
    }

    public static Competencia gerar(long doadorId, YearMonth mes, BigDecimal valor) {
        exigirValorPositivo(valor);
        return new Competencia(null, doadorId, mes, valor, StatusCompetencia.PENDENTE, null, null, null, false);
    }

    /** Pagamento antecipado: a competência nasce paga, com o valor vigente na data do pagamento. */
    public static Competencia gerarPaga(long doadorId, YearMonth mes, BigDecimal valor, long contribuicaoId,
            LocalDate dataPagamento, String numeroRecibo) {
        exigirValorPositivo(valor);
        return new Competencia(null, doadorId, mes, valor, StatusCompetencia.PAGA, dataPagamento, numeroRecibo,
                contribuicaoId, true);
    }

    public static Competencia reconstituir(Long id, long doadorId, YearMonth mes, BigDecimal valor,
            StatusCompetencia status, LocalDate dataPagamento, String numeroRecibo, Long contribuicaoId,
            boolean criadaNoPagamento) {
        return new Competencia(id, doadorId, mes, valor, status, dataPagamento, numeroRecibo, contribuicaoId,
                criadaNoPagamento);
    }

    private static void exigirValorPositivo(BigDecimal valor) {
        if (valor.signum() <= 0) {
            throw new IllegalArgumentException("Valor da mensalidade deve ser positivo.");
        }
    }

    /** Cancela uma competência pendente; pagas nunca mudam (US-DONOR-004). */
    public void cancelar() {
        if (status != StatusCompetencia.PENDENTE) {
            throw new RegraDeNegocioException("COMPETENCIA_NAO_PENDENTE", "Só competências pendentes podem ser canceladas.");
        }
        status = StatusCompetencia.CANCELADA;
    }

    public boolean isPendente() {
        return status == StatusCompetencia.PENDENTE;
    }

    /**
     * Ao cancelar a contribuição, a competência antecipada de um mês ainda futuro deixa de existir;
     * as demais voltam a Pendente (a geração mensal já passou por elas).
     */
    public boolean deveSerRemovidaAoEstornar(YearMonth mesAtual) {
        return criadaNoPagamento && mes.isAfter(mesAtual);
    }

    public Long getId() { return id; }
    public long getDoadorId() { return doadorId; }
    public YearMonth getMes() { return mes; }
    public BigDecimal getValor() { return valor; }
    public StatusCompetencia getStatus() { return status; }
    public LocalDate getDataPagamento() { return dataPagamento; }
    public String getNumeroRecibo() { return numeroRecibo; }
    public Long getContribuicaoId() { return contribuicaoId; }
    public boolean isCriadaNoPagamento() { return criadaNoPagamento; }
}
