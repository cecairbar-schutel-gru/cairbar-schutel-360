package com.durvalcrm.conciliacao.application;

import com.durvalcrm.conciliacao.application.ExtratoBancarioPort.ExtratoImportado;
import com.durvalcrm.conciliacao.application.ExtratoBancarioPort.LinhaExtrato;
import com.durvalcrm.conciliacao.application.LancamentosBancariosPort.LancamentoBancario;
import com.durvalcrm.conciliacao.application.LancamentosBancariosPort.ResumoConciliacao;
import com.durvalcrm.conciliacao.domain.Conciliacao;
import com.durvalcrm.conciliacao.domain.ConciliacaoRepository;
import com.durvalcrm.conciliacao.domain.ExtratoBancario;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.Formato;
import com.durvalcrm.conciliacao.domain.StatusConciliacao;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Leituras da conciliação: contas bancárias com a situação de cada uma (US-RECONCILIATION-001), a
 * sessão com a lista para marcar, o resumo (003) e o extrato importado com as sugestões, e o histórico com o relatório da sessão (010).
 */
public class ConsultarConciliacoesUseCase {

    private final ConciliacaoRepository conciliacoes;
    private final LancamentosBancariosPort lancamentos;
    private final ExtratoBancarioPort extratos;
    private final MovimentoFinanceiroUseCase movimento;

    public ConsultarConciliacoesUseCase(ConciliacaoRepository conciliacoes, LancamentosBancariosPort lancamentos,
            ExtratoBancarioPort extratos, MovimentoFinanceiroUseCase movimento) {
        this.conciliacoes = conciliacoes;
        this.lancamentos = lancamentos;
        this.extratos = extratos;
        this.movimento = movimento;
    }

    /** Toda conta bancária ativa: conciliada até quando, quantos lançamentos faltam e a sessão em andamento. */
    @Transactional(readOnly = true)
    public List<ContaParaConciliar> contas() {
        Map<Long, Long> naoConciliados = lancamentos.naoConciliadosPorConta();
        return movimento.contasAtivas(TipoConta.BANCO).stream().map(conta -> {
            Optional<Conciliacao> ultima = conciliacoes.ultimaConcluida(conta.id());
            Optional<Conciliacao> andamento = conciliacoes.emAndamento(conta.id());
            return new ContaParaConciliar(conta.id(), conta.nome(), conta.banco(), conta.agencia(), conta.numeroConta(),
                    conta.dataCorte(), ultima.map(Conciliacao::getDataFim).orElse(null),
                    ultima.map(Conciliacao::getSaldoExtrato).orElse(null), naoConciliados.getOrDefault(conta.id(), 0L),
                    andamento.map(Conciliacao::getId).orElse(null), andamento.map(Conciliacao::getDataFim).orElse(null));
        }).toList();
    }

    /**
     * Em andamento: todos os lançamentos não conciliados até o fim do extrato, com a marcação. Concluída:
     * o relatório, com os conciliados e os pendentes gravados na conclusão.
     */
    @Transactional(readOnly = true)
    public SessaoConciliacao sessao(long id) {
        Conciliacao c = conciliacoes.buscarPorId(id).orElseThrow(ConsultarConciliacoesUseCase::naoEncontrada);
        ContaFinanceira conta = movimento.conta(c.getContaId()).orElseThrow();
        boolean emAndamento = c.getStatus() == StatusConciliacao.EM_ANDAMENTO;
        List<LancamentoBancario> lista = emAndamento
                ? lancamentos.candidatos(id, conta.id(), conta.dataCorte(), c.getDataFim())
                : lancamentos.conciliados(id);
        List<LancamentoBancario> pendentes = emAndamento ? List.of() : lancamentos.pendentes(id);
        BigDecimal totalMarcado = lancamentos.totalMarcado(id);
        LocalDate dataFimAnterior = emAndamento
                ? conciliacoes.ultimaConcluida(conta.id()).map(Conciliacao::getDataFim).orElse(null)
                : null;
        return new SessaoConciliacao(c.getId(), conta.id(), conta.nome(), conta.banco(), conta.agencia(),
                conta.numeroConta(), c.getDataFim(), dataFimAnterior, c.getSaldoAbertura(), totalMarcado,
                c.saldoConciliado(totalMarcado), c.getSaldoExtrato(), c.diferenca(totalMarcado), c.getStatus(),
                nome(c.getIniciadaPorNome(), c.getIniciadaPor()), c.getIniciadaEm(),
                c.getConcluidaPor() == null ? null : nome(c.getConcluidaPorNome(), c.getConcluidaPor()), c.getConcluidaEm(),
                lista.stream().map(ConsultarConciliacoesUseCase::item).toList(),
                pendentes.stream().map(ConsultarConciliacoesUseCase::item).toList(),
                extratos.buscar(id).map(e -> extrato(e, emAndamento ? lista : List.of(), c.getDataFim())).orElse(null));
    }

    /** Em andamento, cada linha sem par recebe a sugestão (mesmo valor, data próxima) entre os lançamentos sem linha. */
    private static ExtratoDaSessao extrato(ExtratoImportado e, List<LancamentoBancario> candidatos, LocalDate dataFim) {
        Set<Long> ligados = e.linhas().stream().map(LinhaExtrato::lancamentoId).filter(x -> x != null)
                .collect(Collectors.toSet());
        Map<Long, Long> sugestoes = ExtratoBancario.sugerir(
                e.linhas().stream().filter(l -> l.lancamentoId() == null && !l.data().isAfter(dataFim))
                        .map(l -> new ExtratoBancario.Movimento(l.id(), l.data(), l.valor())).toList(),
                candidatos.stream().filter(l -> !ligados.contains(l.id()))
                        .map(l -> new ExtratoBancario.Movimento(l.id(), l.data(), l.valor())).toList());
        return new ExtratoDaSessao(e.arquivo(), e.formato(), e.importadoPor(), e.importadoEm(), e.linhas().stream()
                .map(l -> new LinhaDoExtrato(l.id(), l.data(), l.descricao(), l.valor(), l.identificador(),
                        l.lancamentoId(), l.conferidaPor(), l.conferidaEm(), sugestoes.get(l.id())))
                .toList());
    }

    /** Sessões concluídas (US-RECONCILIATION-010); sem conta, de todas. */
    @Transactional(readOnly = true)
    public List<ResumoConciliacao> historico(Long contaId) {
        return lancamentos.concluidas(contaId);
    }

    /**
     * Contas bancárias ativas não conciliadas até a data (checklist do fechamento mensal, US-CLOSING:
     * "todas as contas conciliadas até o último dia do mês").
     */
    @Transactional(readOnly = true)
    public List<ContaFinanceira> bancosNaoConciliadosAte(LocalDate data) {
        return movimento.contasAtivas(TipoConta.BANCO).stream()
                .filter(conta -> conciliacoes.ultimaConcluida(conta.id())
                        .map(u -> u.getDataFim().isBefore(data)).orElse(true))
                .toList();
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("CONCILIACAO_NAO_ENCONTRADA", "Conciliação não encontrada.");
    }

    private static ItemConciliacao item(LancamentoBancario l) {
        boolean podeCorrigir = OrigemLancamento.ESTORNAVEIS_NO_FINANCEIRO.contains(l.origemTipo())
                && l.estornaLancamentoId() == null && l.estornadoPorId() == null;
        return new ItemConciliacao(l.id(), l.data(), l.descricao(), l.origemTipo(), l.origemId(), l.natureza(), l.valor(),
                l.estornaLancamentoId(), l.estornadoPorId(), l.corrigeLancamentoId(), podeCorrigir, l.marcado(),
                l.marcadoPor(), l.marcadoEm(), l.adicionado());
    }

    private static String nome(String nome, String subject) {
        return nome == null ? subject : nome;
    }

    /**
     * @param conciliadaAte   data final da última sessão concluída (nula: nunca conciliada)
     * @param saldoConciliado saldo do extrato da última sessão concluída
     */
    public record ContaParaConciliar(long contaId, String contaNome, String banco, String agencia, String numeroConta,
            LocalDate dataCorte, LocalDate conciliadaAte, BigDecimal saldoConciliado, long naoConciliados,
            Long sessaoId, LocalDate sessaoDataFim) {
    }

    /**
     * @param podeCorrigir o lançamento é corrigido por estorno no Financeiro (US-FINANCIAL-010); os de
     *                     contribuições e vendas, pelo cancelamento no módulo de origem
     */
    public record ItemConciliacao(long id, LocalDate data, String descricao, String origemTipo, Long origemId,
            NaturezaLancamento natureza, BigDecimal valor, Long estornaLancamentoId, Long estornadoPorId,
            Long corrigeLancamentoId, boolean podeCorrigir, boolean marcado, String marcadoPor, Instant marcadoEm,
            boolean adicionado) {
    }

    /**
     * @param dataFimAnterior em andamento: data final da última sessão concluída (a data deve ser posterior)
     * @param lancamentos     em andamento: os candidatos; concluída: os conciliados
     * @param pendentes       só na concluída: o que ficou sem marcar até a data final
     * @param extrato         extrato do banco importado na sessão (nulo se não houver)
     */
    public record SessaoConciliacao(long id, long contaId, String contaNome, String banco, String agencia,
            String numeroConta, LocalDate dataFim, LocalDate dataFimAnterior, BigDecimal saldoAbertura,
            BigDecimal totalMarcado, BigDecimal saldoConciliado, BigDecimal saldoExtrato, BigDecimal diferenca,
            StatusConciliacao status, String iniciadaPor, Instant iniciadaEm, String concluidaPor, Instant concluidaEm,
            List<ItemConciliacao> lancamentos, List<ItemConciliacao> pendentes, ExtratoDaSessao extrato) {
    }

    public record ExtratoDaSessao(String arquivo, Formato formato, String importadoPor, Instant importadoEm,
            List<LinhaDoExtrato> linhas) {
    }

    /**
     * @param lancamentoId par confirmado
     * @param sugestaoId   em andamento e sem par: o lançamento sugerido (nulo se nenhum)
     */
    public record LinhaDoExtrato(long id, LocalDate data, String descricao, BigDecimal valor, String identificador,
            Long lancamentoId, String conferidaPor, Instant conferidaEm, Long sugestaoId) {
    }
}
