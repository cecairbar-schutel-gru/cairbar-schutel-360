package com.durvalcrm.conciliacao.domain;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Sessão de conciliação de uma conta bancária até a data final do extrato (US-RECONCILIATION-001).
 * Abertura = saldo do extrato da sessão concluída anterior (ou o saldo inicial da conta);
 * diferença = saldo do extrato − (abertura + lançamentos marcados). Só conclui com diferença zero
 * (US-RECONCILIATION-007); depois disso nada é desmarcado: erros se corrigem por estorno.
 */
public final class Conciliacao {

    private final Long id;
    private final long contaId;
    private final LocalDate dataFim;
    private final BigDecimal saldoExtrato;
    private final BigDecimal saldoAbertura;
    private final StatusConciliacao status;
    private final String iniciadaPor;
    private final String iniciadaPorNome;
    private final Instant iniciadaEm;
    private final String concluidaPor;
    private final String concluidaPorNome;
    private final Instant concluidaEm;

    private Conciliacao(Long id, long contaId, LocalDate dataFim, BigDecimal saldoExtrato, BigDecimal saldoAbertura,
            StatusConciliacao status, String iniciadaPor, String iniciadaPorNome, Instant iniciadaEm,
            String concluidaPor, String concluidaPorNome, Instant concluidaEm) {
        this.id = id;
        this.contaId = contaId;
        this.dataFim = Objects.requireNonNull(dataFim);
        this.saldoExtrato = Objects.requireNonNull(saldoExtrato);
        this.saldoAbertura = Objects.requireNonNull(saldoAbertura);
        this.status = Objects.requireNonNull(status);
        this.iniciadaPor = Objects.requireNonNull(iniciadaPor);
        this.iniciadaPorNome = iniciadaPorNome;
        this.iniciadaEm = Objects.requireNonNull(iniciadaEm);
        this.concluidaPor = concluidaPor;
        this.concluidaPorNome = concluidaPorNome;
        this.concluidaEm = concluidaEm;
    }

    /**
     * @param anterior última sessão concluída da conta (nula na primeira conciliação)
     * @param hoje     a data final do extrato vai no máximo até ontem: o extrato do dia só fecha no dia
     *                 seguinte, e uma sessão concluída até hoje deixaria sem conciliação os lançamentos
     *                 feitos depois dela no mesmo dia
     */
    public static Conciliacao iniciar(ContaFinanceira conta, LocalDate dataFim, BigDecimal saldoExtrato,
            Anterior anterior, LocalDate hoje, Lancamento.Autor autor) {
        if (conta.tipo() != TipoConta.BANCO) {
            throw ValidacaoException.doCampo("contaId",
                    "Só contas bancárias são conciliadas. Caixas são conferidos pela contagem do dinheiro e Cartão a receber, pela liquidação.");
        }
        if (!conta.ativa()) {
            throw new RegraDeNegocioException("CONTA_INATIVA", "A conta " + conta.nome() + " está inativa.");
        }
        validarExtrato(conta, dataFim, saldoExtrato, anterior, hoje);
        BigDecimal abertura = anterior == null ? conta.saldoInicial() : anterior.saldoExtrato();
        return new Conciliacao(null, conta.id(), dataFim, saldoExtrato, abertura, StatusConciliacao.EM_ANDAMENTO,
                autor.subject(), autor.nome(), autor.em(), null, null, null);
    }

    public static Conciliacao reconstituir(Long id, long contaId, LocalDate dataFim, BigDecimal saldoExtrato,
            BigDecimal saldoAbertura, StatusConciliacao status, String iniciadaPor, String iniciadaPorNome,
            Instant iniciadaEm, String concluidaPor, String concluidaPorNome, Instant concluidaEm) {
        return new Conciliacao(id, contaId, dataFim, saldoExtrato, saldoAbertura, status, iniciadaPor, iniciadaPorNome,
                iniciadaEm, concluidaPor, concluidaPorNome, concluidaEm);
    }

    /** Correção da data final ou do saldo do extrato digitados errado, só enquanto em andamento. */
    public Conciliacao comExtrato(ContaFinanceira conta, LocalDate novaDataFim, BigDecimal novoSaldo,
            Anterior anterior, LocalDate hoje) {
        exigirEmAndamento();
        validarExtrato(conta, novaDataFim, novoSaldo, anterior, hoje);
        return new Conciliacao(id, contaId, novaDataFim, novoSaldo, saldoAbertura, status, iniciadaPor,
                iniciadaPorNome, iniciadaEm, null, null, null);
    }

    /** Abertura mais os lançamentos marcados. */
    public BigDecimal saldoConciliado(BigDecimal totalMarcado) {
        return saldoAbertura.add(totalMarcado);
    }

    public BigDecimal diferenca(BigDecimal totalMarcado) {
        return saldoExtrato.subtract(saldoConciliado(totalMarcado));
    }

    public Conciliacao concluida(BigDecimal totalMarcado, Lancamento.Autor autor) {
        exigirEmAndamento();
        BigDecimal diferenca = diferenca(totalMarcado);
        if (diferenca.signum() != 0) {
            throw new RegraDeNegocioException("DIFERENCA_NAO_ZERADA", "A diferença é de " + Dinheiro.brl(diferenca)
                    + ": a conciliação só é concluída quando o sistema bate com o extrato.");
        }
        return new Conciliacao(id, contaId, dataFim, saldoExtrato, saldoAbertura, StatusConciliacao.CONCLUIDA,
                iniciadaPor, iniciadaPorNome, iniciadaEm, autor.subject(), autor.nome(), autor.em());
    }

    public void exigirEmAndamento() {
        if (status != StatusConciliacao.EM_ANDAMENTO) {
            throw new RegraDeNegocioException("CONCILIACAO_CONCLUIDA", "Esta conciliação já foi concluída: os "
                    + "lançamentos conciliados não podem ser desmarcados. Corrija um erro por estorno.");
        }
    }

    /** Lançamento registrado na sessão (US-RECONCILIATION-005) precisa caber no extrato. */
    public void exigirDentroDoExtrato(LocalDate data) {
        if (data != null && data.isAfter(dataFim)) {
            throw ValidacaoException.doCampo("data", "Use uma data até o fim do extrato (" + Dinheiro.data(dataFim) + ").");
        }
    }

    private static void validarExtrato(ContaFinanceira conta, LocalDate dataFim, BigDecimal saldo, Anterior anterior,
            LocalDate hoje) {
        List<ErroCampo> erros = new ArrayList<>();
        if (dataFim == null) {
            erros.add(new ErroCampo("dataFim", "Informe a data final do extrato."));
        } else if (!dataFim.isBefore(hoje)) {
            erros.add(new ErroCampo("dataFim", "Use uma data até ontem (" + Dinheiro.data(hoje.minusDays(1))
                    + "): o extrato de hoje só fecha amanhã."));
        } else if (anterior != null && !dataFim.isAfter(anterior.dataFim())) {
            erros.add(new ErroCampo("dataFim", "Use uma data posterior à última conciliação ("
                    + Dinheiro.data(anterior.dataFim()) + ")."));
        } else if (dataFim.isBefore(conta.dataCorte())) {
            erros.add(new ErroCampo("dataFim", "A data é anterior à data de corte da conta ("
                    + Dinheiro.data(conta.dataCorte()) + ")."));
        }
        if (saldo == null) {
            erros.add(new ErroCampo("saldoExtrato", "Informe o saldo final do extrato."));
        } else if (saldo.scale() > 2) {
            erros.add(new ErroCampo("saldoExtrato", "Use no máximo duas casas decimais."));
        }
        ValidacaoException.lancarSeHouver(erros);
    }

    public Long getId() { return id; }
    public long getContaId() { return contaId; }
    public LocalDate getDataFim() { return dataFim; }
    public BigDecimal getSaldoExtrato() { return saldoExtrato; }
    public BigDecimal getSaldoAbertura() { return saldoAbertura; }
    public StatusConciliacao getStatus() { return status; }
    public String getIniciadaPor() { return iniciadaPor; }
    public String getIniciadaPorNome() { return iniciadaPorNome; }
    public Instant getIniciadaEm() { return iniciadaEm; }
    public String getConcluidaPor() { return concluidaPor; }
    public String getConcluidaPorNome() { return concluidaPorNome; }
    public Instant getConcluidaEm() { return concluidaEm; }

    /** Ponto de partida da próxima sessão: data final e saldo do extrato da última concluída. */
    public record Anterior(LocalDate dataFim, BigDecimal saldoExtrato) {

        public static Anterior de(Conciliacao concluida) {
            return new Anterior(concluida.getDataFim(), concluida.getSaldoExtrato());
        }
    }
}
