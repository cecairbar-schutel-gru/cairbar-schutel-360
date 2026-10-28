package com.durvalcrm.contapagar.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contapagar.domain.ContaPagar;
import com.durvalcrm.contapagar.domain.ContaPagarRepository;
import com.durvalcrm.contapagar.domain.PagamentoContaPagar;
import com.durvalcrm.contapagar.domain.PagamentoContaPagarRepository;
import com.durvalcrm.contapagar.domain.Recorrencia;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.NovoLancamento;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Contas a pagar da Tesouraria: cadastro de despesas únicas ou recorrentes, a agenda de vencimentos
 * (pagos, vencidos e a vencer), o pagamento de cada vencimento com a despesa no Financeiro na mesma
 * transação e a reabertura do vencimento quando a despesa é estornada (US-FINANCIAL-010).
 */
public class ContasPagarUseCase {

    static final String ENTIDADE = "ContaPagar";
    static final String ENTIDADE_PAGAMENTO = "PagamentoContaPagar";
    /** Janela de "vencendo em breve" no resumo dos painéis. */
    public static final int DIAS_A_VENCER = 7;
    /** Maior período da agenda consultado de uma vez. */
    static final long MAXIMO_DIAS_AGENDA = 366;

    private final ContaPagarRepository contas;
    private final PagamentoContaPagarRepository pagamentos;
    private final CategoriaRepository categorias;
    private final MovimentoFinanceiroUseCase movimento;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ContasPagarUseCase(ContaPagarRepository contas, PagamentoContaPagarRepository pagamentos,
            CategoriaRepository categorias, MovimentoFinanceiroUseCase movimento, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.contas = contas;
        this.pagamentos = pagamentos;
        this.categorias = categorias;
        this.movimento = movimento;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    public enum Situacao {
        PAGA,
        VENCIDA,
        A_VENCER
    }

    /**
     * Conta na lista do cadastro; {@code proximoVencimento}: o mais antigo em aberto (pode estar vencido);
     * {@code quitada}: única com o vencimento pago.
     */
    public record ResumoConta(ContaPagar conta, String categoriaNome, LocalDate proximoVencimento, boolean quitada) {
    }

    public record PagamentoResumo(long id, LocalDate vencimento, LocalDate pagoEm, BigDecimal valor, long contaId,
            String contaNome, String observacao, Long lancamentoId, String registradoPor, Instant registradoEm,
            Instant estornadoEm) {

        static PagamentoResumo de(PagamentoContaPagar p) {
            return new PagamentoResumo(p.id(), p.vencimento(), p.pagoEm(), p.valor(), p.contaId(), p.contaNome(),
                    p.observacao(), p.lancamentoId(), p.registradoPor(), p.registradoEm(), p.estornadoEm());
        }
    }

    /** {@code emAberto}: vencimentos sem pagamento até hoje mais os próximos (no máximo 12). */
    public record Detalhe(ContaPagar conta, String categoriaNome, List<LocalDate> emAberto,
            List<PagamentoResumo> pagamentos, boolean quitada) {
    }

    /** Um vencimento da agenda; {@code pagamento} só nos pagos. */
    public record Parcela(long contaPagarId, String descricao, String favorecido, String categoria,
            String categoriaNome, Recorrencia recorrencia, LocalDate vencimento, BigDecimal valorPrevisto,
            Long contaFinanceiraId, Situacao situacao, PagamentoResumo pagamento) {
    }

    public record Resumo(long vencidas, BigDecimal valorVencidas, long aVencer, BigDecimal valorAVencer,
            int diasAVencer) {
    }

    public record PagamentoCommand(Long contaPagarId, LocalDate vencimento, LocalDate pagoEm, BigDecimal valor,
            Long contaId, String observacao, String chaveIdempotencia) {
    }

    public record Resultado(long id, Long lancamentoId, List<String> avisos) {
    }

    // Cadastro

    /** {@code todas}: inclui as encerradas. */
    @Transactional(readOnly = true)
    public List<ResumoConta> listar(boolean todas) {
        LocalDate hoje = LocalDate.now(relogio);
        Map<String, String> nomes = nomesCategorias();
        Map<Long, List<PagamentoContaPagar>> pagos = pagamentos.validosAte(hoje.plusYears(2)).stream()
                .collect(Collectors.groupingBy(PagamentoContaPagar::contaPagarId));
        return contas.listar().stream()
                .filter(c -> todas || c.ativa())
                .map(c -> {
                    List<PagamentoContaPagar> daConta = pagos.getOrDefault(c.id(), List.of());
                    return new ResumoConta(c, nomes.get(c.categoria()),
                            emAberto(c, daConta, hoje, 1).stream().findFirst().orElse(null),
                            c.quitada(!daConta.isEmpty()));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Detalhe detalhe(long id) {
        ContaPagar c = carregar(id);
        List<PagamentoContaPagar> daConta = pagamentos.daConta(id);
        List<PagamentoContaPagar> validos = daConta.stream().filter(p -> !p.estornado()).toList();
        return new Detalhe(c, nomesCategorias().get(c.categoria()),
                emAberto(c, validos, LocalDate.now(relogio), 12),
                daConta.stream().map(PagamentoResumo::de).toList(), c.quitada(!validos.isEmpty()));
    }

    @Transactional
    public ContaPagar cadastrar(ContaPagar.Dados dados) {
        ContaPagar validada = ContaPagar.nova(dados, categoria(dados.categoria()));
        exigirContaFinanceira(validada.contaFinanceiraId());
        ContaPagar nova = contas.salvar(validada);
        auditoria.registrar("CONTA_PAGAR_CADASTRADA", ENTIDADE, nova.id(), detalhes(nova));
        return nova;
    }

    @Transactional
    public ContaPagar alterar(long id, ContaPagar.Dados dados) {
        ContaPagar atual = contas.travar(id).orElseThrow(ContasPagarUseCase::naoEncontrada);
        LocalDate ultimoPago = pagamentos.daConta(id).stream().filter(p -> !p.estornado())
                .map(PagamentoContaPagar::vencimento).max(Comparator.naturalOrder()).orElse(null);
        ContaPagar alterada = atual.alterada(dados, categoria(dados.categoria()), ultimoPago,
                pagamentos.existeDaConta(id));
        exigirContaFinanceira(alterada.contaFinanceiraId());
        contas.salvar(alterada);
        auditoria.registrarAlteracao("CONTA_PAGAR_ALTERADA", ENTIDADE, id, detalhes(atual), detalhes(alterada), null);
        return alterada;
    }

    @Transactional
    public ContaPagar encerrar(long id) {
        ContaPagar encerrada = contas.salvar(contas.travar(id).orElseThrow(ContasPagarUseCase::naoEncontrada).encerrada());
        auditoria.registrar("CONTA_PAGAR_ENCERRADA", ENTIDADE, id, Map.of());
        return encerrada;
    }

    @Transactional
    public ContaPagar reativar(long id) {
        ContaPagar reativada = contas.salvar(contas.travar(id).orElseThrow(ContasPagarUseCase::naoEncontrada).reativada());
        auditoria.registrar("CONTA_PAGAR_REATIVADA", ENTIDADE, id, Map.of());
        return reativada;
    }

    /** Só sem nenhum pagamento (nem estornado); com pagamentos, a conta é encerrada. */
    @Transactional
    public void excluir(long id) {
        ContaPagar c = contas.travar(id).orElseThrow(ContasPagarUseCase::naoEncontrada);
        if (pagamentos.existeDaConta(id)) {
            throw new RegraDeNegocioException("CONTA_PAGAR_COM_PAGAMENTOS",
                    "Esta conta já tem pagamentos: encerre-a em vez de excluir.");
        }
        contas.excluir(id);
        auditoria.registrar("CONTA_PAGAR_EXCLUIDA", ENTIDADE, id, detalhes(c));
    }

    // Agenda

    /**
     * Vencimentos entre {@code de} e {@code ate}; com {@code incluirVencidas}, também os vencidos e
     * não pagos de antes de {@code de}.
     */
    @Transactional(readOnly = true)
    public List<Parcela> parcelas(LocalDate de, LocalDate ate, boolean incluirVencidas) {
        if (de == null || ate == null) {
            throw ValidacaoException.doCampo("de", "Informe o período.");
        }
        if (ate.isBefore(de)) {
            throw ValidacaoException.doCampo("ate", "A data final deve ser igual ou posterior à inicial.");
        }
        if (ChronoUnit.DAYS.between(de, ate) > MAXIMO_DIAS_AGENDA) {
            throw ValidacaoException.doCampo("ate", "Consulte no máximo um ano por vez.");
        }
        LocalDate hoje = LocalDate.now(relogio);
        Map<String, String> nomes = nomesCategorias();
        Map<Long, Map<LocalDate, PagamentoContaPagar>> pagos = new HashMap<>();
        for (PagamentoContaPagar p : pagamentos.validosAte(ate)) {
            pagos.computeIfAbsent(p.contaPagarId(), k -> new HashMap<>()).put(p.vencimento(), p);
        }
        List<Parcela> parcelas = new ArrayList<>();
        for (ContaPagar c : contas.listar()) {
            Map<LocalDate, PagamentoContaPagar> daConta = pagos.getOrDefault(c.id(), Map.of());
            LocalDate inicio = incluirVencidas ? c.primeiroVencimento() : de;
            for (LocalDate v : c.vencimentos(inicio, ate)) {
                PagamentoContaPagar p = daConta.get(v);
                if (v.isBefore(de) && (p != null || !v.isBefore(hoje))) {
                    continue;
                }
                parcelas.add(parcela(c, v, p, hoje, nomes));
            }
            // Pagos de vencimentos que a conta não tem mais (encerrada ou com novo fim) continuam na agenda.
            daConta.values().stream()
                    .filter(p -> !p.vencimento().isBefore(de) && !c.venceEm(p.vencimento()))
                    .forEach(p -> parcelas.add(parcela(c, p.vencimento(), p, hoje, nomes)));
        }
        parcelas.sort(Comparator.comparing(Parcela::vencimento).thenComparing(Parcela::descricao)
                .thenComparing(Parcela::contaPagarId));
        return parcelas;
    }

    /** Vencidas e não pagas, e as que vencem nos próximos {@value #DIAS_A_VENCER} dias (painéis). */
    @Transactional(readOnly = true)
    public Resumo resumo() {
        LocalDate hoje = LocalDate.now(relogio);
        List<Parcela> abertas = parcelas(hoje, hoje.plusDays(DIAS_A_VENCER), true).stream()
                .filter(p -> p.situacao() != Situacao.PAGA).toList();
        List<Parcela> vencidas = abertas.stream().filter(p -> p.situacao() == Situacao.VENCIDA).toList();
        List<Parcela> aVencer = abertas.stream().filter(p -> p.situacao() == Situacao.A_VENCER).toList();
        return new Resumo(vencidas.size(), soma(vencidas), aVencer.size(), soma(aVencer), DIAS_A_VENCER);
    }

    // Pagamento

    @Transactional
    public Resultado pagar(PagamentoCommand cmd) {
        if (!Textos.vazio(cmd.chaveIdempotencia())) {
            Optional<PagamentoContaPagar> existente = pagamentos.porChave(cmd.chaveIdempotencia().trim());
            if (existente.isPresent()) {
                return new Resultado(existente.get().id(), existente.get().lancamentoId(), List.of());
            }
        }
        if (cmd.contaPagarId() == null) {
            throw ValidacaoException.doCampo("contaPagarId", "Escolha a conta a pagar.");
        }
        ContaPagar conta = contas.travar(cmd.contaPagarId()).orElseThrow(ContasPagarUseCase::naoEncontrada);
        if (cmd.vencimento() != null && pagamentos.pago(conta.id(), cmd.vencimento())) {
            throw new RegraDeNegocioException("VENCIMENTO_JA_PAGO",
                    "O vencimento de " + Dinheiro.data(cmd.vencimento()) + " já foi pago.");
        }
        Categoria categoria = categorias.buscar(conta.categoria()).orElse(null);
        if (categoria == null || !categoria.ativa()) {
            throw new RegraDeNegocioException("CATEGORIA_INATIVA",
                    "A categoria desta conta foi inativada: escolha outra no cadastro da conta antes de pagar.");
        }
        ContaFinanceira origem = cmd.contaId() == null ? null : movimento.conta(cmd.contaId()).orElse(null);
        PagamentoContaPagar salvo = pagamentos.salvar(PagamentoContaPagar.novo(conta, cmd.vencimento(), cmd.pagoEm(),
                LocalDate.now(relogio), cmd.valor(), origem, cmd.observacao(), cmd.chaveIdempotencia(),
                usuario.getSubject(), usuario.getNome(), relogio.instant()));
        ResultadoLancamento despesa = movimento.lancarComAvisos(new NovoLancamento(salvo.pagoEm(),
                OrigemLancamento.CONTA_PAGAR, salvo.id(), descricao(conta, salvo.vencimento()),
                List.of(new LinhaConta(salvo.contaId(), salvo.valor().negate())),
                List.of(new LinhaCategoria(conta.categoria(), salvo.valor().negate()))));
        pagamentos.salvar(salvo.comLancamento(despesa.id()));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("contaPagarId", conta.id());
        detalhes.put("vencimento", salvo.vencimento().toString());
        detalhes.put("pagoEm", salvo.pagoEm().toString());
        detalhes.put("valor", salvo.valor());
        detalhes.put("contaId", salvo.contaId());
        detalhes.put("lancamentoId", despesa.id());
        auditoria.registrar("CONTA_PAGAR_PAGA", ENTIDADE_PAGAMENTO, salvo.id(), detalhes);
        ContaPagar depois = conta.aposPagamento();
        if (depois != conta) {
            contas.salvar(depois);
            auditoria.registrar("CONTA_PAGAR_QUITADA", ENTIDADE, conta.id(), Map.of("pagamentoId", salvo.id()));
        }
        return new Resultado(salvo.id(), despesa.id(), despesa.avisos());
    }

    /**
     * A despesa do pagamento foi estornada no Financeiro: o vencimento volta a ficar em aberto e a conta
     * única quitada é reativada.
     */
    @Transactional
    public void aoEstornar(long pagamentoId) {
        PagamentoContaPagar p = pagamentos.travar(pagamentoId).orElse(null);
        if (p == null || p.estornado()) {
            return;
        }
        pagamentos.salvar(p.estornadoEm(relogio.instant()));
        auditoria.registrar("PAGAMENTO_CONTA_PAGAR_ESTORNADO", ENTIDADE_PAGAMENTO, pagamentoId,
                Map.of("lancamentoId", p.lancamentoId() == null ? "" : p.lancamentoId()));
        contas.travar(p.contaPagarId()).ifPresent(c -> {
            ContaPagar depois = c.aposEstorno();
            if (depois != c) {
                contas.salvar(depois);
                auditoria.registrar("CONTA_PAGAR_REATIVADA", ENTIDADE, c.id(), Map.of("pagamentoId", pagamentoId));
            }
        });
    }

    private List<LocalDate> emAberto(ContaPagar c, List<PagamentoContaPagar> validos, LocalDate hoje, int limite) {
        var pagos = validos.stream().map(PagamentoContaPagar::vencimento).collect(Collectors.toSet());
        LocalDate ate = c.recorrencia() == Recorrencia.ANUAL ? hoje.plusYears(limite) : hoje.plusMonths(limite);
        return c.vencimentos(c.primeiroVencimento(), ate.isBefore(c.primeiroVencimento()) ? c.primeiroVencimento() : ate)
                .stream().filter(v -> !pagos.contains(v)).limit(limite).toList();
    }

    private Parcela parcela(ContaPagar c, LocalDate v, PagamentoContaPagar p, LocalDate hoje, Map<String, String> nomes) {
        Situacao s = p != null ? Situacao.PAGA : v.isBefore(hoje) ? Situacao.VENCIDA : Situacao.A_VENCER;
        return new Parcela(c.id(), c.descricao(), c.favorecido(), c.categoria(), nomes.get(c.categoria()),
                c.recorrencia(), v, c.valorPrevisto(), c.contaFinanceiraId(), s, p == null ? null : PagamentoResumo.de(p));
    }

    private static BigDecimal soma(List<Parcela> parcelas) {
        return parcelas.stream().map(Parcela::valorPrevisto).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<String, String> nomesCategorias() {
        return categorias.listar().stream().collect(Collectors.toMap(Categoria::codigo, Categoria::nomeCompleto,
                (a, b) -> a, HashMap::new));
    }

    private Categoria categoria(String codigo) {
        return Textos.vazio(codigo) ? null : categorias.buscar(codigo.trim()).orElse(null);
    }

    private void exigirContaFinanceira(Long id) {
        if (id == null) {
            return;
        }
        ContaFinanceira c = movimento.conta(id).orElse(null);
        if (c == null || !c.ativa() || c.tipo() == TipoConta.CARTAO_A_RECEBER) {
            throw ValidacaoException.doCampo("contaFinanceiraId", "Escolha um caixa ou uma conta bancária ativa.");
        }
    }

    private ContaPagar carregar(long id) {
        return contas.obter(id).orElseThrow(ContasPagarUseCase::naoEncontrada);
    }

    static RecursoNaoEncontradoException naoEncontrada() {
        return new RecursoNaoEncontradoException("CONTA_PAGAR_NAO_ENCONTRADA", "Conta a pagar não encontrada.");
    }

    private static String descricao(ContaPagar c, LocalDate vencimento) {
        String texto = c.descricao() + " (vencimento " + Dinheiro.data(vencimento) + ")";
        return texto.length() <= 200 ? texto : texto.substring(0, 199) + "…";
    }

    private static Map<String, Object> detalhes(ContaPagar c) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("descricao", c.descricao());
        d.put("favorecido", c.favorecido());
        d.put("categoria", c.categoria());
        d.put("valorPrevisto", c.valorPrevisto());
        d.put("recorrencia", c.recorrencia().name());
        d.put("primeiroVencimento", c.primeiroVencimento().toString());
        d.put("fimRecorrencia", c.fimRecorrencia() == null ? null : c.fimRecorrencia().toString());
        d.put("contaFinanceiraId", c.contaFinanceiraId());
        return d;
    }
}
