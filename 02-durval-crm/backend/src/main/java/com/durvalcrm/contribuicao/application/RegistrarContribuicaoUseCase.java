package com.durvalcrm.contribuicao.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaPaga;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.contribuicao.domain.Pagamento;
import com.durvalcrm.contribuicao.domain.Recebimento;
import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.NovoLancamento;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.TipoCartao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Confirma a contribuição numa única transação (US-CONTRIB-006/007/008): quita as competências,
 * gera o recibo e lança receitas e contas no financeiro com a data do recebimento.
 */
public class RegistrarContribuicaoUseCase {

    static final String ORIGEM = "CONTRIBUICAO";
    public static final String JA_PAGA = "Esta competência acabou de ser paga.";

    private final ContribuicaoRepository contribuicoes;
    private final CompetenciaRepository competencias;
    private final DoadoresPort doadores;
    private final MensalidadeVigentePort mensalidade;
    private final NumeracaoReciboPort numeracao;
    private final MovimentoFinanceiroUseCase financeiro;
    private final OpcoesPagamentoUseCase opcoes;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public RegistrarContribuicaoUseCase(ContribuicaoRepository contribuicoes, CompetenciaRepository competencias,
            DoadoresPort doadores, MensalidadeVigentePort mensalidade, NumeracaoReciboPort numeracao,
            MovimentoFinanceiroUseCase financeiro, OpcoesPagamentoUseCase opcoes, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.contribuicoes = contribuicoes;
        this.competencias = competencias;
        this.doadores = doadores;
        this.mensalidade = mensalidade;
        this.numeracao = numeracao;
        this.financeiro = financeiro;
        this.opcoes = opcoes;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Contribuicao registrar(RegistrarContribuicaoCommand cmd) {
        if (Textos.vazio(cmd.chaveIdempotencia()) || cmd.chaveIdempotencia().length() > 100) {
            throw ValidacaoException.doCampo("chaveIdempotencia", "Chave de idempotência inválida.");
        }
        // Clique duplo ou nova tentativa: devolve a contribuição já registrada com a mesma chave.
        Optional<Contribuicao> repetida = contribuicoes.buscarPorChaveIdempotencia(cmd.chaveIdempotencia());
        if (repetida.isPresent()) {
            return repetida.get();
        }

        LocalDate hoje = LocalDate.now(relogio);
        YearMonth mesAtual = YearMonth.from(hoje);
        validarIdentificacao(cmd);
        List<Pagamento> pagamentos = pagamentos(cmd);
        Map<YearMonth, Optional<Competencia>> escolhidas = competenciasEscolhidas(cmd, mesAtual);
        BigDecimal valorAntecipado = mensalidade.valorPara(mesAtual);
        List<CompetenciaPaga> pagas = escolhidas.entrySet().stream()
                .map(e -> new CompetenciaPaga(e.getKey(), e.getValue().map(Competencia::getValor).orElse(valorAntecipado)))
                .toList();

        Recebimento recebimento = new Recebimento(cmd.anonima() ? null : cmd.doadorId(), cmd.anonima(), pagas,
                cmd.valorDoacao(), pagamentos, cmd.observacao());
        Contribuicao contribuicao = contribuicoes.salvar(Contribuicao.registrar(recebimento, usuario.getSubject(),
                usuario.getNome(), relogio.instant(), hoje, cmd.chaveIdempotencia(),
                () -> numeracao.proximo(hoje.getYear())));

        quitar(contribuicao, escolhidas, valorAntecipado, hoje);
        contribuicao.vincularLancamento(financeiro.lancar(lancamento(contribuicao)));
        Contribuicao salva = contribuicoes.salvar(contribuicao);

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("recibo", salva.getNumeroRecibo());
        detalhes.put("tipo", salva.getTipo().name());
        detalhes.put("total", salva.total());
        auditoria.registrar("CONTRIBUICAO_REGISTRADA", CarregarContribuicao.ENTIDADE, salva.getId(), detalhes);
        return salva;
    }

    private void validarIdentificacao(RegistrarContribuicaoCommand cmd) {
        if (!cmd.anonima() && !usuario.hasRole("operador")) {
            throw new RegraDeNegocioException("SOMENTE_DOACAO_ANONIMA",
                    "Seu perfil recebe só doações anônimas; mensalidades e doações de doadores ficam com o Operador.");
        }
        if (cmd.anonima()) {
            if (cmd.doadorId() != null || !cmd.competencias().isEmpty()) {
                throw ValidacaoException.doCampo("doadorId",
                        "Doação anônima não se vincula a doador nem a competência.");
            }
            return;
        }
        if (cmd.doadorId() == null) {
            throw ValidacaoException.doCampo("doadorId", "Informe o doador.");
        }
        DoadoresPort.DoadorResumo doador = CarregarContribuicao.doadorOu404(doadores, cmd.doadorId());
        if (doador.anonimizado()) {
            throw new RegraDeNegocioException("DOADOR_ANONIMIZADO", "Doador anonimizado não recebe contribuições.");
        }
    }

    private List<Pagamento> pagamentos(RegistrarContribuicaoCommand cmd) {
        List<Pagamento> resultado = new ArrayList<>();
        for (RegistrarContribuicaoCommand.Pagamento p : cmd.pagamentos()) {
            if (p.meio() == null || p.valor() == null) {
                throw ValidacaoException.doCampo("pagamentos", "Informe o meio e o valor de cada pagamento.");
            }
            ContaFinanceira conta = opcoes.contaDe(p.meio());
            resultado.add(new Pagamento(p.meio(), conta.id(), conta.nome(), p.valor(), p.tipoCartao()));
        }
        return resultado;
    }

    /**
     * Cada mês escolhido: a competência gravada (deve estar pendente) ou um mês futuro, de até 12
     * meses à frente, ainda não gerado.
     */
    private Map<YearMonth, Optional<Competencia>> competenciasEscolhidas(RegistrarContribuicaoCommand cmd,
            YearMonth mesAtual) {
        Map<YearMonth, Optional<Competencia>> escolhidas = new LinkedHashMap<>();
        if (cmd.competencias().isEmpty()) {
            return escolhidas;
        }
        DoadoresPort.DoadorResumo doador = CarregarContribuicao.doadorOu404(doadores, cmd.doadorId());
        for (YearMonth mes : new LinkedHashSet<>(cmd.competencias().stream().sorted().toList())) {
            Optional<Competencia> gravada = competencias.buscar(cmd.doadorId(), mes);
            if (gravada.isPresent()) {
                if (gravada.get().getStatus() == StatusCompetencia.PAGA) {
                    throw new RegraDeNegocioException("COMPETENCIA_JA_PAGA", JA_PAGA);
                }
                if (gravada.get().getStatus() == StatusCompetencia.CANCELADA) {
                    throw new RegraDeNegocioException("COMPETENCIA_CANCELADA",
                            "A competência " + formatar(mes) + " está cancelada e não pode ser paga.");
                }
            } else if (!doador.ativo() || mes.isBefore(mesAtual)
                    || mes.isAfter(mesAtual.plusMonths(ConsultarCompetenciasUseCase.MESES_FUTUROS))) {
                throw ValidacaoException.doCampo("competencias",
                        "A competência " + formatar(mes) + " não está disponível para pagamento.");
            }
            escolhidas.put(mes, gravada);
        }
        return escolhidas;
    }

    /** Update condicional: se outro Operador pagou antes, nada é gravado (rollback). */
    private void quitar(Contribuicao c, Map<YearMonth, Optional<Competencia>> escolhidas, BigDecimal valorAntecipado,
            LocalDate hoje) {
        for (Map.Entry<YearMonth, Optional<Competencia>> e : escolhidas.entrySet()) {
            boolean ok = e.getValue().isPresent()
                    ? competencias.marcarComoPaga(e.getValue().get().getId(), c.getId(), hoje, c.getNumeroRecibo())
                    : competencias.inserirPaga(Competencia.gerarPaga(c.getDoadorId(), e.getKey(), valorAntecipado,
                            c.getId(), hoje, c.getNumeroRecibo()));
            if (!ok) {
                throw new RegraDeNegocioException("COMPETENCIA_JA_PAGA", JA_PAGA);
            }
        }
    }

    /**
     * Uma linha por conta de recebimento e uma por subcategoria de receita. A linha de Cartão a
     * receber leva o tipo do cartão (há um único pagamento em cartão por contribuição).
     */
    private static NovoLancamento lancamento(Contribuicao c) {
        Map<Long, BigDecimal> porConta = new LinkedHashMap<>();
        Map<Long, TipoCartao> tipoPorConta = new LinkedHashMap<>();
        for (Pagamento p : c.getPagamentos()) {
            porConta.merge(p.contaId(), p.valor(), BigDecimal::add);
            if (p.tipoCartao() != null) {
                tipoPorConta.put(p.contaId(), p.tipoCartao());
            }
        }
        List<LinhaConta> contas = porConta.entrySet().stream()
                .map(e -> new LinhaConta(e.getKey(), e.getValue(), tipoPorConta.get(e.getKey()))).toList();
        List<LinhaCategoria> categorias = new ArrayList<>();
        if (c.totalCompetencias().signum() > 0) {
            categorias.add(new LinhaCategoria(CategoriaFinanceira.MENSALIDADES, c.totalCompetencias()));
        }
        if (c.getValorDoacao().signum() > 0) {
            categorias.add(new LinhaCategoria(c.isAnonima() ? CategoriaFinanceira.DOACOES_ANONIMAS
                    : CategoriaFinanceira.DOACOES_EXTRAORDINARIAS, c.getValorDoacao()));
        }
        return new NovoLancamento(c.getDataFinanceira(), ORIGEM, c.getId(),
                "Contribuição — recibo nº " + c.getNumeroRecibo(), contas, categorias);
    }

    static String formatar(YearMonth mes) {
        return String.format("%02d/%d", mes.getMonthValue(), mes.getYear());
    }
}
