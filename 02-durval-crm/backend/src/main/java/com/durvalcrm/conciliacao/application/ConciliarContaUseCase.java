package com.durvalcrm.conciliacao.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.conciliacao.application.ExtratoBancarioPort.ExtratoImportado;
import com.durvalcrm.conciliacao.application.ExtratoBancarioPort.LinhaExtrato;
import com.durvalcrm.conciliacao.application.LancamentosBancariosPort.LancamentoBancario;
import com.durvalcrm.conciliacao.domain.Conciliacao;
import com.durvalcrm.conciliacao.domain.ConciliacaoRepository;
import com.durvalcrm.conciliacao.domain.ExtratoBancario;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.Formato;
import com.durvalcrm.conciliacao.domain.ExtratoBancario.LinhaNova;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.LancamentoManualCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.TransferenciaCommand;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.OperacoesFinanceirasUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ações da conciliação: iniciar (US-RECONCILIATION-001), marcar e desmarcar (003), registrar o
 * lançamento ausente (005), importar o extrato e confirmar os pares sugeridos, e concluir (007). Cada ação é gravada na hora, numa transação com a sessão
 * travada, e vai para o log de auditoria.
 */
public class ConciliarContaUseCase {

    static final String ENTIDADE = "Conciliacao";

    private final ConciliacaoRepository conciliacoes;
    private final LancamentosBancariosPort lancamentos;
    private final ExtratoBancarioPort extratos;
    private final MovimentoFinanceiroUseCase movimento;
    private final OperacoesFinanceirasUseCase operacoes;
    private final PeriodoFinanceiroPort periodos;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public ConciliarContaUseCase(ConciliacaoRepository conciliacoes, LancamentosBancariosPort lancamentos,
            ExtratoBancarioPort extratos, MovimentoFinanceiroUseCase movimento, OperacoesFinanceirasUseCase operacoes,
            PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        this.conciliacoes = conciliacoes;
        this.lancamentos = lancamentos;
        this.extratos = extratos;
        this.movimento = movimento;
        this.operacoes = operacoes;
        this.periodos = periodos;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    /** Uma sessão em andamento por conta: abrir a conta de novo retoma a mesma (código CONCILIACAO_EM_ANDAMENTO). */
    @Transactional
    public Conciliacao iniciar(Long contaId, LocalDate dataFim, BigDecimal saldoExtrato) {
        if (contaId == null) {
            throw ValidacaoException.doCampo("contaId", "Escolha a conta bancária.");
        }
        ContaFinanceira conta = conta(contaId);
        // Mês fechado não recebe conciliação (US-CLOSING-008).
        periodos.exigirAberto(dataFim);
        conciliacoes.emAndamento(contaId).ifPresent(c -> {
            throw new RegraDeNegocioException("CONCILIACAO_EM_ANDAMENTO",
                    "Já existe uma conciliação em andamento para " + conta.nome() + ": continue-a.");
        });
        Conciliacao nova = conciliacoes.salvar(Conciliacao.iniciar(conta, dataFim, saldoExtrato, anterior(contaId),
                LocalDate.now(relogio), movimento.autor()));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("contaId", contaId);
        detalhes.put("dataFim", nova.getDataFim().toString());
        detalhes.put("saldoExtrato", nova.getSaldoExtrato());
        detalhes.put("saldoAbertura", nova.getSaldoAbertura());
        auditoria.registrar("CONCILIACAO_INICIADA", ENTIDADE, nova.getId(), detalhes);
        return nova;
    }

    /** Correção dos dados do extrato; marcações depois da nova data final são desfeitas. */
    @Transactional
    public Conciliacao alterarExtrato(long id, LocalDate dataFim, BigDecimal saldoExtrato) {
        Conciliacao atual = travar(id);
        periodos.exigirAberto(dataFim);
        Conciliacao alterada = conciliacoes.salvar(atual.comExtrato(conta(atual.getContaId()), dataFim, saldoExtrato,
                anterior(atual.getContaId()), LocalDate.now(relogio)));
        int desmarcados = lancamentos.desmarcarDepoisDe(id, alterada.getDataFim());
        extratos.desligarNaoMarcados(id);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("dataFimAnterior", atual.getDataFim().toString());
        detalhes.put("saldoExtratoAnterior", atual.getSaldoExtrato());
        detalhes.put("dataFim", alterada.getDataFim().toString());
        detalhes.put("saldoExtrato", alterada.getSaldoExtrato());
        detalhes.put("desmarcados", desmarcados);
        auditoria.registrar("CONCILIACAO_EXTRATO_ALTERADO", ENTIDADE, id, detalhes);
        return alterada;
    }

    /** Um clique marca ou desmarca; "Selecionar todos os exibidos" manda a lista filtrada. */
    @Transactional
    public void marcar(long id, List<Long> ids, boolean marcado) {
        Conciliacao c = travar(id);
        c.exigirEmAndamento();
        Set<Long> escolhidos = ids == null ? Set.of() : ids.stream().filter(x -> x != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (escolhidos.isEmpty()) {
            throw ValidacaoException.doCampo("lancamentoIds", "Escolha ao menos um lançamento.");
        }
        int alterados;
        if (marcado) {
            ContaFinanceira conta = conta(c.getContaId());
            Set<Long> disponiveis = lancamentos.candidatos(id, c.getContaId(), conta.dataCorte(), c.getDataFim())
                    .stream().map(LancamentoBancario::id).collect(Collectors.toSet());
            List<Long> fora = escolhidos.stream().filter(x -> !disponiveis.contains(x)).toList();
            if (!fora.isEmpty()) {
                throw new RegraDeNegocioException("LANCAMENTO_NAO_CONCILIAVEL", "O lançamento nº " + fora.get(0)
                        + " não pode ser marcado: ele não é desta conta, já foi conciliado ou é posterior ao fim do extrato.");
            }
            alterados = lancamentos.marcar(id, c.getContaId(), escolhidos, movimento.autor(), false);
        } else {
            alterados = lancamentos.desmarcar(id, escolhidos);
            extratos.desligarNaoMarcados(id);
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("lancamentos", List.copyOf(escolhidos));
        detalhes.put("alterados", alterados);
        auditoria.registrar(marcado ? "LANCAMENTOS_MARCADOS" : "LANCAMENTOS_DESMARCADOS", ENTIDADE, id, detalhes);
    }

    /**
     * Movimento do banco que o sistema não tem (ex.: tarifa): lançamento manual (US-FINANCIAL-009) na
     * conta da sessão ou, para dinheiro do caixa depositado, transferência (US-FINANCIAL-003). Entra já
     * marcado e sinalizado "Adicionado na conciliação".
     */
    @Transactional
    public ResultadoLancamento adicionarLancamento(long id, NovoLancamentoConciliacao cmd) {
        Conciliacao c = travar(id);
        c.exigirEmAndamento();
        if (cmd == null || cmd.tipo() == null) {
            throw ValidacaoException.doCampo("tipo", "Escolha receita, despesa ou transferência.");
        }
        c.exigirDentroDoExtrato(cmd.data());
        if (cmd.linhaExtratoId() != null) {
            linhaSemPar(id, cmd.linhaExtratoId());
        }
        ResultadoLancamento r = switch (cmd.tipo()) {
            case RECEITA, DESPESA -> operacoes.lancarManual(new LancamentoManualCommand(c.getContaId(), cmd.data(),
                    cmd.tipo() == TipoLancamentoAusente.RECEITA ? TipoCategoria.RECEITA : TipoCategoria.DESPESA,
                    cmd.categoria(), cmd.valor(), cmd.descricao(), null, cmd.chaveIdempotencia()));
            case TRANSFERENCIA -> {
                if (cmd.contraparteId() == null) {
                    throw ValidacaoException.doCampo("contraparteId", "Escolha a outra conta da transferência.");
                }
                if (cmd.contraparteId() == c.getContaId()) {
                    throw ValidacaoException.doCampo("contraparteId", "Escolha uma conta diferente da conciliada.");
                }
                boolean entrada = !Boolean.FALSE.equals(cmd.entrada());
                yield operacoes.transferir(new TransferenciaCommand(entrada ? cmd.contraparteId() : c.getContaId(),
                        entrada ? c.getContaId() : cmd.contraparteId(), cmd.valor(), cmd.data(), cmd.descricao(),
                        cmd.chaveIdempotencia()));
            }
        };
        lancamentos.marcar(id, c.getContaId(), List.of(r.id()), movimento.autor(), true);
        if (cmd.linhaExtratoId() != null) {
            extratos.ligar(id, cmd.linhaExtratoId(), r.id(), movimento.autor());
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("lancamentoId", r.id());
        detalhes.put("tipo", cmd.tipo().name());
        if (cmd.linhaExtratoId() != null) {
            detalhes.put("linhaExtratoId", cmd.linhaExtratoId());
        }
        auditoria.registrar("LANCAMENTO_ADICIONADO", ENTIDADE, id, detalhes);
        return r;
    }

    /**
     * Extrato do banco lido no navegador (OFX ou CSV): ficam as linhas depois da última conciliação (ou
     * desde o corte da conta) e até o fim do extrato da sessão. Importar de novo substitui o anterior.
     *
     * @return quantas linhas ficaram fora do período
     */
    @Transactional
    public int importarExtrato(long id, ImportacaoExtrato cmd) {
        Conciliacao c = travar(id);
        c.exigirEmAndamento();
        if (cmd == null) {
            throw ValidacaoException.doCampo("linhas", "O arquivo não tem movimentos.");
        }
        ContaFinanceira conta = conta(c.getContaId());
        LocalDate depoisDe = conciliacoes.ultimaConcluida(c.getContaId()).map(Conciliacao::getDataFim)
                .orElse(conta.dataCorte().minusDays(1));
        ExtratoBancario.Selecao selecao = ExtratoBancario.selecionar(cmd.arquivo(), cmd.formato(), cmd.linhas(),
                depoisDe, c.getDataFim());
        extratos.substituir(id, cmd.arquivo(), cmd.formato(), selecao.noPeriodo(), movimento.autor());
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("arquivo", cmd.arquivo().strip());
        detalhes.put("formato", cmd.formato().name());
        detalhes.put("linhas", selecao.noPeriodo().size());
        detalhes.put("ignoradas", selecao.ignoradas());
        auditoria.registrar("EXTRATO_IMPORTADO", ENTIDADE, id, detalhes);
        return selecao.ignoradas();
    }

    /**
     * Confirma pares linha do extrato → lançamento (as sugestões aceitas ou uma escolha do Tesoureiro):
     * o lançamento fica marcado na sessão e a linha, conferida.
     */
    @Transactional
    public void confirmarPares(long id, List<ParExtrato> pares) {
        Conciliacao c = travar(id);
        c.exigirEmAndamento();
        if (pares == null || pares.isEmpty()) {
            throw ValidacaoException.doCampo("pares", "Escolha ao menos um par para confirmar.");
        }
        ExtratoImportado extrato = extratos.buscar(id).orElseThrow(ConciliarContaUseCase::semExtrato);
        Map<Long, LinhaExtrato> linhas = extrato.linhas().stream()
                .collect(Collectors.toMap(LinhaExtrato::id, Function.identity()));
        Set<Long> jaLigados = extrato.linhas().stream().map(LinhaExtrato::lancamentoId).filter(x -> x != null)
                .collect(Collectors.toCollection(HashSet::new));
        ContaFinanceira conta = conta(c.getContaId());
        Set<Long> disponiveis = lancamentos.candidatos(id, c.getContaId(), conta.dataCorte(), c.getDataFim())
                .stream().map(LancamentoBancario::id).collect(Collectors.toSet());
        Set<Long> linhasDoPedido = new HashSet<>();
        List<Long> ids = new ArrayList<>();
        for (ParExtrato par : pares) {
            if (par == null || par.linhaId() == null || par.lancamentoId() == null) {
                throw ValidacaoException.doCampo("pares", "Cada par precisa da linha do extrato e do lançamento.");
            }
            LinhaExtrato linha = linhas.get(par.linhaId());
            if (linha == null) {
                throw new RecursoNaoEncontradoException("LINHA_EXTRATO_NAO_ENCONTRADA",
                        "A linha do extrato não foi encontrada nesta conciliação: importe o extrato de novo.");
            }
            if (linha.lancamentoId() != null || !linhasDoPedido.add(linha.id())) {
                throw new RegraDeNegocioException("LINHA_EXTRATO_CONFERIDA",
                        "A linha “" + linha.descricao() + "” do extrato já tem um lançamento.");
            }
            if (!disponiveis.contains(par.lancamentoId())) {
                throw new RegraDeNegocioException("LANCAMENTO_NAO_CONCILIAVEL", "O lançamento nº " + par.lancamentoId()
                        + " não pode ser marcado: ele não é desta conta, já foi conciliado ou é posterior ao fim do extrato.");
            }
            if (!jaLigados.add(par.lancamentoId())) {
                throw new RegraDeNegocioException("LANCAMENTO_JA_PAREADO",
                        "O lançamento nº " + par.lancamentoId() + " já está ligado a outra linha do extrato.");
            }
            ids.add(par.lancamentoId());
        }
        lancamentos.marcar(id, c.getContaId(), ids, movimento.autor(), false);
        for (ParExtrato par : pares) {
            extratos.ligar(id, par.linhaId(), par.lancamentoId(), movimento.autor());
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("pares", pares.stream().map(p -> Map.of("linhaId", p.linhaId(), "lancamentoId", p.lancamentoId()))
                .toList());
        auditoria.registrar("EXTRATO_PARES_CONFIRMADOS", ENTIDADE, id, detalhes);
    }

    /** Desfaz o par da linha: o lançamento é desmarcado e a linha volta a ter sugestão. */
    @Transactional
    public void desfazerPar(long id, long linhaId) {
        Conciliacao c = travar(id);
        c.exigirEmAndamento();
        Optional<Long> lancamento = extratos.desligar(id, linhaId);
        if (lancamento.isEmpty()) {
            throw new RecursoNaoEncontradoException("LINHA_EXTRATO_NAO_ENCONTRADA",
                    "A linha do extrato não foi encontrada ou não tem lançamento.");
        }
        lancamentos.desmarcar(id, List.of(lancamento.get()));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("linhaId", linhaId);
        detalhes.put("lancamentoId", lancamento.get());
        auditoria.registrar("EXTRATO_PAR_DESFEITO", ENTIDADE, id, detalhes);
    }

    /** Só com diferença zero; a conta fica conciliada até a data final do extrato. */
    @Transactional
    public Conciliacao concluir(long id) {
        Conciliacao c = travar(id);
        periodos.exigirAberto(c.getDataFim());
        Conciliacao concluida = c.concluida(lancamentos.totalMarcado(id), movimento.autor());
        ContaFinanceira conta = conta(c.getContaId());
        int[] contagem = lancamentos.efetivar(id, c.getContaId(), conta.dataCorte(), c.getDataFim());
        conciliacoes.salvar(concluida);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("contaId", c.getContaId());
        detalhes.put("dataFim", c.getDataFim().toString());
        detalhes.put("saldoExtrato", c.getSaldoExtrato());
        detalhes.put("conciliados", contagem[0]);
        detalhes.put("pendentes", contagem[1]);
        auditoria.registrar("CONCILIACAO_CONCLUIDA", ENTIDADE, id, detalhes);
        return concluida;
    }

    private void linhaSemPar(long id, long linhaId) {
        LinhaExtrato linha = extratos.buscar(id).orElseThrow(ConciliarContaUseCase::semExtrato).linhas().stream()
                .filter(l -> l.id() == linhaId).findFirst()
                .orElseThrow(() -> new RecursoNaoEncontradoException("LINHA_EXTRATO_NAO_ENCONTRADA",
                        "A linha do extrato não foi encontrada nesta conciliação."));
        if (linha.lancamentoId() != null) {
            throw new RegraDeNegocioException("LINHA_EXTRATO_CONFERIDA",
                    "A linha “" + linha.descricao() + "” do extrato já tem um lançamento.");
        }
    }

    private static RegraDeNegocioException semExtrato() {
        return new RegraDeNegocioException("EXTRATO_NAO_IMPORTADO", "Importe o extrato do banco antes de confirmar pares.");
    }

    private Conciliacao.Anterior anterior(long contaId) {
        return conciliacoes.ultimaConcluida(contaId).map(Conciliacao.Anterior::de).orElse(null);
    }

    private Conciliacao travar(long id) {
        return conciliacoes.travar(id).orElseThrow(ConsultarConciliacoesUseCase::naoEncontrada);
    }

    private ContaFinanceira conta(long id) {
        return movimento.conta(id).orElseThrow(() -> new RecursoNaoEncontradoException("CONTA_NAO_ENCONTRADA",
                "Conta não encontrada."));
    }

    public enum TipoLancamentoAusente {
        RECEITA,
        DESPESA,
        /** Entre contas próprias (ex.: depósito do dinheiro do caixa): não é receita. */
        TRANSFERENCIA
    }

    /**
     * @param categoria     subcategoria (receita ou despesa)
     * @param contraparteId a outra conta da transferência
     * @param entrada       transferência que entra na conta conciliada (padrão) ou sai dela
     * @param linhaExtratoId linha do extrato importado que o lançamento explica (opcional)
     */
    public record NovoLancamentoConciliacao(TipoLancamentoAusente tipo, LocalDate data, BigDecimal valor,
            String descricao, String categoria, Long contraparteId, Boolean entrada, String chaveIdempotencia,
            Long linhaExtratoId) {
    }

    public record ImportacaoExtrato(String arquivo, Formato formato, List<LinhaNova> linhas) {
    }

    public record ParExtrato(Long linhaId, Long lancamentoId) {
    }
}
