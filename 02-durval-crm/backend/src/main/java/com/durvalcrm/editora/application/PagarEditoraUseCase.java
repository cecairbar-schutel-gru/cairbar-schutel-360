package com.durvalcrm.editora.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaObrigacao;
import com.durvalcrm.editora.domain.Alocacao;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.Obrigacao;
import com.durvalcrm.editora.domain.ObrigacaoRepository;
import com.durvalcrm.editora.domain.PagamentoEditora;
import com.durvalcrm.editora.domain.PagamentoEditoraRepository;
import com.durvalcrm.editora.domain.StatusObrigacao;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.NovoLancamento;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pagamento a editora, parcial ou total (US-PUBLISHER-008): prévia da alocação, gravação com a
 * despesa "Despesas comerciais › Repasse às editoras" na mesma transação, recibo e a reabertura das
 * obrigações quando a despesa é estornada no Financeiro (US-FINANCIAL-010).
 */
public class PagarEditoraUseCase {

    public static final String CATEGORIA_REPASSE = "DESPESAS_COMERCIAIS.REPASSE_EDITORAS";
    static final String ENTIDADE = "PagamentoEditora";

    private final EditoraRepository editoras;
    private final ObrigacaoRepository obrigacoes;
    private final PagamentoEditoraRepository pagamentos;
    private final ConsultaEditorasPort consulta;
    private final MovimentoFinanceiroUseCase movimento;
    private final DadosOrganizacaoPort organizacao;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public PagarEditoraUseCase(EditoraRepository editoras, ObrigacaoRepository obrigacoes,
            PagamentoEditoraRepository pagamentos, ConsultaEditorasPort consulta, MovimentoFinanceiroUseCase movimento,
            DadosOrganizacaoPort organizacao, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.editoras = editoras;
        this.obrigacoes = obrigacoes;
        this.pagamentos = pagamentos;
        this.consulta = consulta;
        this.movimento = movimento;
        this.organizacao = organizacao;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    public record PagamentoCommand(Long editoraId, LocalDate pagoEm, BigDecimal valor, Long contaId,
            MeioPagamentoEditora meio, String observacao, String chaveIdempotencia) {
    }

    /** Uma obrigação coberta (ou a cobrir, na prévia), com o que fica em aberto depois. */
    public record LinhaAlocacao(long obrigacaoId, LocalDate data, String origem, Long origemNumero,
            String remessaCodigo, String titulo, BigDecimal valorAberto, BigDecimal valorAlocado, BigDecimal restante) {
    }

    public record Previa(BigDecimal saldoDevido, BigDecimal creditoAplicado, BigDecimal valor,
            List<LinhaAlocacao> alocacoes, BigDecimal saldoDepois) {
    }

    public record Resultado(long id, Long lancamentoId, List<String> avisos) {
    }

    /** Recibo do pagamento (US-PUBLISHER-008). */
    public record Recibo(PagamentoEditora pagamento, String editoraNome, String editoraCnpj,
            List<LinhaAlocacao> alocacoes, DadosOrganizacao organizacao) {
    }

    /** A alocação que o pagamento faria, sem gravar nada. */
    @Transactional(readOnly = true)
    public Previa previa(long editoraId, BigDecimal valor) {
        editoras.obter(editoraId).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        if (valor == null || valor.signum() <= 0) {
            throw ValidacaoException.doCampo("valor", "Informe um valor maior que zero.");
        }
        List<Obrigacao> abertas = obrigacoes.abertas(editoraId, false);
        BigDecimal credito = obrigacoes.creditoDisponivel(editoraId);
        BigDecimal saldo = PagamentoEditora.saldoDevido(abertas, credito);
        BigDecimal valorUsado = valor.min(saldo.max(BigDecimal.ZERO));
        BigDecimal aplicado = PagamentoEditora.creditoAplicavel(abertas, credito);
        List<Alocacao> alocacoes = PagamentoEditora.alocar(abertas, valorUsado.add(aplicado));
        Map<Long, Obrigacao> porId = abertas.stream().collect(Collectors.toMap(Obrigacao::getId, Function.identity()));
        return new Previa(saldo, aplicado, valorUsado, linhas(alocacoes, porId, true), saldo.subtract(valorUsado));
    }

    @Transactional
    public Resultado pagar(PagamentoCommand cmd) {
        if (cmd.chaveIdempotencia() != null) {
            PagamentoEditora existente = pagamentos.porChave(cmd.chaveIdempotencia().trim()).orElse(null);
            if (existente != null) {
                return new Resultado(existente.getId(), existente.getLancamentoId(), List.of());
            }
        }
        if (cmd.editoraId() == null) {
            throw ValidacaoException.doCampo("editoraId", "Escolha a editora.");
        }
        Editora editora = editoras.travar(cmd.editoraId()).orElseThrow(CadastroEditorasUseCase::naoEncontrada);
        List<Obrigacao> abertas = obrigacoes.abertas(editora.id(), true);
        BigDecimal credito = obrigacoes.creditoDisponivel(editora.id());
        ContaFinanceira conta = cmd.contaId() == null ? null : movimento.conta(cmd.contaId()).orElse(null);
        Instant agora = relogio.instant();
        PagamentoEditora novo = PagamentoEditora.novo(editora.id(), cmd.pagoEm(), LocalDate.now(relogio), cmd.valor(),
                conta, cmd.meio(), cmd.observacao(), cmd.chaveIdempotencia(), abertas, credito, usuario.getSubject(),
                usuario.getNome(), agora);
        PagamentoEditora salvo = pagamentos.salvar(novo);
        ResultadoLancamento despesa = movimento.lancarComAvisos(new NovoLancamento(salvo.getPagoEm(),
                OrigemLancamento.PAGAMENTO_EDITORA, salvo.getId(), descricao(editora, salvo),
                List.of(new LinhaConta(salvo.getContaId(), salvo.getValor().negate())),
                List.of(new LinhaCategoria(CATEGORIA_REPASSE, salvo.getValor().negate()))));
        salvo.registrarLancamento(despesa.id());
        pagamentos.salvar(salvo);
        Map<Long, Obrigacao> porId = abertas.stream().collect(Collectors.toMap(Obrigacao::getId, Function.identity()));
        for (Alocacao a : salvo.getAlocacoes()) {
            obrigacoes.salvar(porId.get(a.obrigacaoId()));
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("editoraId", editora.id());
        detalhes.put("pagoEm", salvo.getPagoEm().toString());
        detalhes.put("valor", salvo.getValor());
        detalhes.put("creditoAplicado", salvo.getCreditoAplicado());
        detalhes.put("contaId", salvo.getContaId());
        detalhes.put("meio", salvo.getMeio().name());
        detalhes.put("lancamentoId", despesa.id());
        detalhes.put("alocacoes", salvo.getAlocacoes().stream()
                .map(a -> Map.of("obrigacaoId", a.obrigacaoId(), "valor", a.valor())).toList());
        auditoria.registrar("PAGAMENTO_EDITORA_REGISTRADO", ENTIDADE, salvo.getId(), detalhes);
        return new Resultado(salvo.getId(), despesa.id(), despesa.avisos());
    }

    @Transactional(readOnly = true)
    public Recibo recibo(long id) {
        PagamentoEditora p = pagamentos.obter(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "PAGAMENTO_NAO_ENCONTRADO", "Pagamento não encontrado."));
        Editora e = editoras.obter(p.getEditoraId()).orElseThrow();
        Map<Long, LinhaObrigacao> linhas = consulta.obrigacoesPorId(p.getAlocacoes().stream()
                .map(Alocacao::obrigacaoId).toList());
        List<LinhaAlocacao> alocacoes = p.getAlocacoes().stream().map(a -> {
            LinhaObrigacao o = linhas.get(a.obrigacaoId());
            return new LinhaAlocacao(a.obrigacaoId(), o.data(), o.origem().name(), o.origemNumero(), o.remessaCodigo(),
                    o.titulo(), o.valor(), a.valor(), o.valorAberto());
        }).toList();
        return new Recibo(p, e.nome(), e.cnpj(), alocacoes, organizacao.atuais());
    }

    /**
     * A despesa do pagamento foi estornada no Financeiro: o pagamento fica estornado e cada obrigação
     * coberta volta a ter o valor em aberto. Se a obrigação já tinha sido estornada (venda cancelada),
     * o crédito que ela gerou diminui.
     */
    @Transactional
    public void aoEstornar(long pagamentoId) {
        PagamentoEditora p = pagamentos.travar(pagamentoId).orElse(null);
        if (p == null || p.estornado()) {
            return;
        }
        editoras.travar(p.getEditoraId());
        Instant agora = relogio.instant();
        p.estornar(agora);
        Map<Long, Obrigacao> porId = obrigacoes.obter(p.getAlocacoes().stream().map(Alocacao::obrigacaoId).toList())
                .stream().collect(Collectors.toMap(Obrigacao::getId, Function.identity()));
        for (Alocacao a : p.getAlocacoes()) {
            Obrigacao o = porId.get(a.obrigacaoId());
            o.reabrir(a.valor());
            obrigacoes.salvar(o);
            if (o.getStatus() == StatusObrigacao.ESTORNADA) {
                obrigacoes.registrarCredito(o.getEditoraId(), o.getId(), a.valor().negate(), agora);
            }
        }
        pagamentos.salvar(p);
        auditoria.registrar("PAGAMENTO_EDITORA_ESTORNADO", ENTIDADE, pagamentoId, Map.of("lancamentoId",
                p.getLancamentoId() == null ? "" : p.getLancamentoId()));
    }

    private List<LinhaAlocacao> linhas(List<Alocacao> alocacoes, Map<Long, Obrigacao> porId, boolean previa) {
        Map<Long, LinhaObrigacao> linhas = consulta.obrigacoesPorId(alocacoes.stream().map(Alocacao::obrigacaoId).toList());
        return alocacoes.stream().map(a -> {
            LinhaObrigacao o = linhas.get(a.obrigacaoId());
            BigDecimal aberto = previa ? porId.get(a.obrigacaoId()).getValorAberto() : o.valorAberto();
            return new LinhaAlocacao(a.obrigacaoId(), o.data(), o.origem().name(), o.origemNumero(), o.remessaCodigo(),
                    o.titulo(), aberto, a.valor(), aberto.subtract(a.valor()));
        }).toList();
    }

    private static String descricao(Editora e, PagamentoEditora p) {
        String texto = "Repasse à editora " + e.nome() + " (pagamento nº " + p.getId() + ")";
        return texto.length() <= 200 ? texto : texto.substring(0, 199) + "…";
    }
}
