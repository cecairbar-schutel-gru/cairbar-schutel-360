package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.springframework.transaction.annotation.Transactional;

/**
 * API do módulo Financeiro para os demais módulos: contas, lançamentos automáticos, estornos e
 * saldos. As transações são abertas pelo caso de uso chamador. Todo lançamento passa pelas regras
 * do servidor: contas ativas, data a partir do corte, período aberto e caixa ou Cartão a receber
 * nunca negativos (conferidos com a conta travada).
 */
public class MovimentoFinanceiroUseCase {

    private final ContaFinanceiraRepository contas;
    private final LancamentoRepository lancamentos;
    private final PeriodoFinanceiroPort periodos;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public MovimentoFinanceiroUseCase(ContaFinanceiraRepository contas, LancamentoRepository lancamentos,
            PeriodoFinanceiroPort periodos, CurrentUserPort usuario, Clock relogio) {
        this.contas = contas;
        this.lancamentos = lancamentos;
        this.periodos = periodos;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<ContaFinanceira> contasAtivas(TipoConta tipo) {
        return contas.listarAtivas(tipo);
    }

    @Transactional(readOnly = true)
    public Optional<ContaFinanceira> conta(long id) {
        return contas.buscarPorId(id);
    }

    @Transactional(readOnly = true)
    public ContaFinanceira cartaoAReceber() {
        return contas.cartaoAReceber();
    }

    /** Saldo inicial mais os lançamentos. */
    @Transactional(readOnly = true)
    public BigDecimal saldo(long contaId) {
        return lancamentos.saldo(contaId);
    }

    /** Se o lançamento já tem estorno (ex.: feito direto no Financeiro, US-FINANCIAL-010). */
    @Transactional(readOnly = true)
    public boolean estornado(long lancamentoId) {
        return lancamentos.existeEstornoDe(lancamentoId);
    }

    /** Registra o lançamento; todas as contas devem existir e estar ativas. */
    @Transactional
    public long lancar(NovoLancamento novo) {
        return lancarComAvisos(novo).id();
    }

    @Transactional
    public ResultadoLancamento lancarComAvisos(NovoLancamento novo) {
        Lancamento lancamento = Lancamento.novo(novo.dataFinanceira(), novo.origemTipo(), novo.origemId(),
                novo.descricao(), autor(), novo.linhasConta(), novo.linhasCategoria(), novo.complemento());
        return gravar(lancamento);
    }

    /**
     * Estorna o lançamento na data original; se o mês original estiver fechado, o estorno vai para
     * hoje, no período aberto (US-CLOSING-008).
     */
    @Transactional
    public long estornar(long lancamentoId, String descricao) {
        return estornar(lancamentoId, descricao, null).id();
    }

    @Transactional
    public ResultadoLancamento estornar(long lancamentoId, String descricao, String motivo) {
        Lancamento original = lancamentos.buscarPorId(lancamentoId)
                .orElseThrow(() -> new RecursoNaoEncontradoException("LANCAMENTO_NAO_ENCONTRADO",
                        "Lançamento não encontrado."));
        if (original.getEstornaLancamentoId() != null) {
            throw new RegraDeNegocioException("ESTORNO_NAO_ESTORNAVEL", "Um estorno não pode ser estornado.");
        }
        if (lancamentos.existeEstornoDe(lancamentoId)) {
            throw new RegraDeNegocioException("LANCAMENTO_JA_ESTORNADO", "Este lançamento já foi estornado.");
        }
        LocalDate data = periodos.estaFechado(YearMonth.from(original.getDataFinanceira()))
                ? LocalDate.now(relogio)
                : original.getDataFinanceira();
        return gravar(original.estorno(data, descricao, motivo, autor()));
    }

    /**
     * Histórico importado (US-ADMIN-012): só antes da data de corte de cada conta, com o período
     * aberto e sem conferir saldo (o saldo inicial do corte já contém esse histórico). Origem
     * {@code IMPORTACAO}, com o id da importação.
     */
    @Transactional
    public long importar(LocalDate data, long importacaoId, String descricao, List<LinhaConta> linhasConta,
            List<LinhaCategoria> linhasCategoria) {
        Lancamento lancamento = Lancamento.novo(data, OrigemLancamento.IMPORTACAO, importacaoId, descricao, autor(),
                linhasConta, linhasCategoria, Lancamento.Complemento.NENHUM);
        periodos.exigirAberto(data);
        for (LinhaConta linha : linhasConta) {
            ContaFinanceira conta = contas.buscarPorId(linha.contaId())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("CONTA_NAO_ENCONTRADA", "Conta não encontrada."));
            if (!data.isBefore(conta.dataCorte())) {
                throw new RegraDeNegocioException("DEPOIS_DA_DATA_DE_CORTE", "O histórico de " + conta.nome()
                        + " deve ser anterior à data de corte (" + Dinheiro.data(conta.dataCorte()) + ").");
            }
        }
        return lancamentos.salvar(lancamento).getId();
    }

    /** Nenhum lançamento da importação foi estornado, reclassificado, conciliado ou recebeu anexo. */
    @Transactional(readOnly = true)
    public boolean importacaoIntocada(long importacaoId) {
        return lancamentos.origemIntocada(OrigemLancamento.IMPORTACAO, importacaoId);
    }

    /** Desfaz a importação por inteiro; devolve quantos lançamentos foram removidos. */
    @Transactional
    public int desfazerImportacao(long importacaoId) {
        if (!importacaoIntocada(importacaoId)) {
            throw new RegraDeNegocioException("IMPORTACAO_COM_MOVIMENTOS",
                    "Algum lançamento importado já foi estornado, reclassificado ou conciliado.");
        }
        return lancamentos.excluirDaOrigem(OrigemLancamento.IMPORTACAO, importacaoId);
    }

    public Lancamento.Autor autor() {
        return new Lancamento.Autor(usuario.getSubject(), usuario.getNome(), relogio.instant());
    }

    private ResultadoLancamento gravar(Lancamento lancamento) {
        periodos.exigirAberto(lancamento.getDataFinanceira());
        // Travadas em ordem de id para não haver impasse entre transações concorrentes.
        Map<Long, BigDecimal> movimentoPorConta = new TreeMap<>();
        for (LinhaConta linha : lancamento.getLinhasConta()) {
            movimentoPorConta.merge(linha.contaId(), linha.valor(), BigDecimal::add);
        }
        List<String> avisos = new ArrayList<>();
        for (Map.Entry<Long, BigDecimal> e : movimentoPorConta.entrySet()) {
            ContaFinanceira conta = contas.travar(e.getKey())
                    .orElseThrow(() -> new RecursoNaoEncontradoException("CONTA_NAO_ENCONTRADA", "Conta não encontrada."));
            if (!conta.ativa()) {
                throw new RegraDeNegocioException("CONTA_INATIVA", "A conta " + conta.nome() + " está inativa.");
            }
            conta.exigirDataAPartirDoCorte(lancamento.getDataFinanceira());
            if (e.getValue().signum() >= 0) {
                continue;
            }
            BigDecimal atual = lancamentos.saldo(conta.id());
            BigDecimal depois = atual.add(e.getValue());
            if (depois.signum() < 0) {
                if (!conta.podeFicarNegativa()) {
                    throw new RegraDeNegocioException("SALDO_INSUFICIENTE", "O saldo de " + conta.nome()
                            + " ficaria negativo (" + Dinheiro.brl(depois) + "). Saldo atual: " + Dinheiro.brl(atual) + ".");
                }
                avisos.add("O saldo de " + conta.nome() + " ficou negativo: " + Dinheiro.brl(depois) + ".");
            }
        }
        return new ResultadoLancamento(lancamentos.salvar(lancamento).getId(), avisos);
    }
}
