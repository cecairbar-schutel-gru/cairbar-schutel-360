package com.durvalcrm.financeiro.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.Correcao;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.EstornoCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.LancamentoManualCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.LiquidacaoCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.ReclassificacaoCommand;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.TransferenciaCommand;
import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.AnexoLancamentoRepository;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ClassificacaoRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.LancamentoManual;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.LiquidacaoCartao;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.financeiro.domain.Reclassificacao;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.financeiro.domain.Transferencia;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
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
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Operações da Tesouraria: transferência interna (US-FINANCIAL-003), liquidação de cartão (004),
 * lançamento manual (009), estorno com correção (010) e reclassificação (021). Cada operação é uma
 * única transação, auditada, e passa pelas regras de {@link MovimentoFinanceiroUseCase}.
 */
public class OperacoesFinanceirasUseCase {

    static final String ENTIDADE = "LancamentoFinanceiro";
    public static final int MINIMO_MOTIVO_ESTORNO = 10;
    public static final int MAXIMO_MOTIVO_ESTORNO = 500;

    private final MovimentoFinanceiroUseCase movimento;
    private final ContaFinanceiraRepository contas;
    private final LancamentoRepository lancamentos;
    private final CategoriaRepository categorias;
    private final ClassificacaoRepository classificacoes;
    private final AnexoLancamentoRepository anexos;
    private final PeriodoFinanceiroPort periodos;
    private final RegistrarAuditoriaUseCase auditoria;
    private final List<EstornoNaOrigemPort> origens;
    private final Clock relogio;

    public OperacoesFinanceirasUseCase(MovimentoFinanceiroUseCase movimento, ContaFinanceiraRepository contas,
            LancamentoRepository lancamentos, CategoriaRepository categorias, ClassificacaoRepository classificacoes,
            AnexoLancamentoRepository anexos, PeriodoFinanceiroPort periodos, RegistrarAuditoriaUseCase auditoria,
            List<EstornoNaOrigemPort> origens, Clock relogio) {
        this.movimento = movimento;
        this.contas = contas;
        this.lancamentos = lancamentos;
        this.categorias = categorias;
        this.classificacoes = classificacoes;
        this.anexos = anexos;
        this.periodos = periodos;
        this.auditoria = auditoria;
        this.origens = List.copyOf(origens);
        this.relogio = relogio;
    }

    @Transactional
    public ResultadoLancamento transferir(TransferenciaCommand cmd) {
        Optional<ResultadoLancamento> repetido = jaRegistrado(cmd.chaveIdempotencia());
        if (repetido.isPresent()) {
            return repetido.get();
        }
        ResultadoLancamento r = transferencia(cmd.contaOrigemId(), cmd.contaDestinoId(), cmd.valor(), cmd.data(),
                cmd.descricao(), new Lancamento.Complemento(null, null, chave(cmd.chaveIdempotencia())));
        auditar("TRANSFERENCIA_REGISTRADA", r.id());
        return r;
    }

    @Transactional
    public ResultadoLancamento liquidarCartao(LiquidacaoCommand cmd) {
        Optional<ResultadoLancamento> repetido = jaRegistrado(cmd.chaveIdempotencia());
        if (repetido.isPresent()) {
            return repetido.get();
        }
        ResultadoLancamento r = liquidacao(cmd.contaBancariaId(), cmd.data(), cmd.bruto(), cmd.taxa(),
                cmd.tipoCartao(), cmd.referencia(), null, chave(cmd.chaveIdempotencia()));
        auditar("LIQUIDACAO_CARTAO_REGISTRADA", r.id());
        return r;
    }

    @Transactional
    public ResultadoLancamento lancarManual(LancamentoManualCommand cmd) {
        Optional<ResultadoLancamento> repetido = jaRegistrado(cmd.chaveIdempotencia());
        if (repetido.isPresent()) {
            return repetido.get();
        }
        ResultadoLancamento r = manual(cmd.contaId(), cmd.data(), cmd.tipo(), cmd.categoria(), cmd.valor(),
                cmd.descricao(), cmd.anexo(), new Lancamento.Complemento(null, null, chave(cmd.chaveIdempotencia())));
        auditar("LANCAMENTO_MANUAL_REGISTRADO", r.id());
        return r;
    }

    /**
     * Estorna o lançamento (na data original ou, se o mês estiver fechado, hoje) e, se pedido,
     * registra o lançamento correto ligado ao original. O original nunca é editado.
     */
    @Transactional
    public ResultadoEstorno estornar(long id, EstornoCommand cmd) {
        Lancamento original = carregar(id);
        if (!OrigemLancamento.ESTORNAVEIS_NO_FINANCEIRO.contains(original.getOrigemTipo())) {
            throw new RegraDeNegocioException("CORRIGIR_PELO_CANCELAMENTO", switch (original.getOrigemTipo()) {
                case OrigemLancamento.CONTRIBUICAO -> "Contribuições são corrigidas pelo cancelamento da contribuição.";
                case OrigemLancamento.VENDA -> "Vendas são corrigidas pelo cancelamento da venda.";
                default -> "Este lançamento é corrigido no módulo que o gerou.";
            });
        }
        String motivo = Textos.compactar(cmd == null ? null : cmd.motivo());
        if (motivo.length() < MINIMO_MOTIVO_ESTORNO || motivo.length() > MAXIMO_MOTIVO_ESTORNO) {
            throw ValidacaoException.doCampo("motivo", "Explique o motivo do estorno (de 10 a 500 caracteres).");
        }
        boolean conciliado = lancamentos.conciliado(id);
        ResultadoLancamento estorno = movimento.estornar(id, "Estorno: " + original.getDescricao(), motivo);
        if (original.getOrigemId() != null) {
            origens.stream().filter(o -> o.origemTipo().equals(original.getOrigemTipo()))
                    .forEach(o -> o.lancamentoEstornado(original.getOrigemId()));
        }
        List<String> avisos = new ArrayList<>(estorno.avisos());
        if (conciliado) {
            avisos.add("O lançamento original estava conciliado: concilie também o estorno na próxima sessão.");
        }
        Long correcaoId = null;
        if (cmd.correcao() != null) {
            ResultadoLancamento correcao = corrigir(original, cmd.correcao());
            correcaoId = correcao.id();
            avisos.addAll(correcao.avisos());
        }
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("estornoId", estorno.id());
        detalhes.put("correcaoId", correcaoId);
        detalhes.put("motivo", motivo);
        auditoria.registrar("LANCAMENTO_ESTORNADO", ENTIDADE, id, detalhes);
        return new ResultadoEstorno(estorno.id(), correcaoId, avisos);
    }

    @Transactional
    public void reclassificar(long id, ReclassificacaoCommand cmd) {
        Lancamento lancamento = carregar(id);
        if (periodos.estaFechado(YearMonth.from(lancamento.getDataFinanceira()))) {
            throw new RegraDeNegocioException("PERIODO_FECHADO",
                    "O lançamento é de um mês fechado. Peça ao Administrador a reabertura do período.");
        }
        int ordem = cmd.ordem() == null ? 0 : cmd.ordem();
        if (ordem < 0 || ordem >= lancamento.getLinhasCategoria().size()) {
            throw ValidacaoException.doCampo("ordem", "Escolha a linha de categoria a reclassificar.");
        }
        LinhaCategoria linha = lancamento.getLinhasCategoria().get(ordem);
        Categoria atual = categorias.buscar(linha.categoria()).orElseThrow();
        Categoria nova = cmd.categoria() == null ? null : categorias.buscar(cmd.categoria()).orElse(null);
        Reclassificacao r = Reclassificacao.de(lancamento, lancamentos.existeEstornoDe(id), ordem, atual, nova,
                cmd.motivo(), movimento.autor());
        classificacoes.reclassificar(r);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("ordem", ordem);
        detalhes.put("categoriaAnterior", r.categoriaAnterior());
        detalhes.put("categoriaNova", r.categoriaNova());
        detalhes.put("motivo", r.motivo());
        auditoria.registrar("LANCAMENTO_RECLASSIFICADO", ENTIDADE, id, detalhes);
    }

    private ResultadoLancamento corrigir(Lancamento original, Correcao c) {
        Lancamento.Complemento complemento = new Lancamento.Complemento(original.getId(), null, null);
        return switch (original.getOrigemTipo()) {
            case OrigemLancamento.MANUAL -> {
                AnexoLancamento anexo = anexos.obter(original.getId()).orElse(null);
                yield manual(c.contaId(), c.data(), c.tipo(), c.categoria(), c.valor(), c.descricao(), anexo,
                        complemento);
            }
            case OrigemLancamento.TRANSFERENCIA -> transferencia(c.contaId(), c.contaDestinoId(), c.valor(), c.data(),
                    c.descricao(), complemento);
            case OrigemLancamento.LIQUIDACAO_CARTAO -> liquidacao(c.contaId(), c.data(), c.valor(), c.taxa(),
                    tipoLiquidado(original), c.referencia(), original.getId(), null);
            default -> throw new RegraDeNegocioException("CORRECAO_NAO_DISPONIVEL",
                    "Registre o lançamento correto no módulo que gerou o original.");
        };
    }

    private ResultadoLancamento transferencia(Long origemId, Long destinoId, BigDecimal valor, LocalDate data,
            String descricao, Lancamento.Complemento complemento) {
        List<ErroCampo> erros = new ArrayList<>();
        exigirData(data, erros);
        if (origemId == null) {
            erros.add(new ErroCampo("contaOrigemId", "Escolha a conta de origem."));
        }
        if (destinoId == null) {
            erros.add(new ErroCampo("contaDestinoId", "Escolha a conta de destino."));
        }
        ValidacaoException.lancarSeHouver(erros);
        ContaFinanceira origem = conta(origemId, "contaOrigemId");
        ContaFinanceira destino = conta(destinoId, "contaDestinoId");
        String texto = descricao(descricao, "Transferência de " + origem.nome() + " para " + destino.nome());
        return movimento.lancarComAvisos(new NovoLancamento(data, OrigemLancamento.TRANSFERENCIA, null, texto,
                Transferencia.linhas(origem, destino, valor), List.of(), complemento));
    }

    /** A correção de uma liquidação mantém o tipo liquidado informado na original. */
    private static TipoCartao tipoLiquidado(Lancamento original) {
        return original.getLinhasConta().stream().map(LinhaConta::tipoCartao).filter(Objects::nonNull).findFirst()
                .orElse(null);
    }

    private ResultadoLancamento liquidacao(Long bancoId, LocalDate data, BigDecimal bruto, BigDecimal taxa,
            TipoCartao tipoCartao, String referencia, Long corrige, String chave) {
        List<ErroCampo> erros = new ArrayList<>();
        exigirData(data, erros);
        if (bancoId == null) {
            erros.add(new ErroCampo("contaBancariaId", "Escolha a conta bancária que recebeu o depósito."));
        }
        String ref = Textos.compactar(referencia);
        if (ref.length() > 60) {
            erros.add(new ErroCampo("referencia", "Use até 60 caracteres."));
        }
        ValidacaoException.lancarSeHouver(erros);
        ContaFinanceira cartao = contas.travar(contas.cartaoAReceber().id()).orElseThrow();
        ContaFinanceira banco = conta(bancoId, "contaBancariaId");
        LiquidacaoCartao l = LiquidacaoCartao.de(bruto, taxa, tipoCartao, lancamentos.saldo(cartao.id()));
        String texto = "Liquidação de cartão" + (tipoCartao == null ? "" : " de " + tipoCartao.rotulo()) + ": bruto "
                + Dinheiro.brl(l.bruto()) + ", taxa " + Dinheiro.brl(l.taxa()) + (ref.isEmpty() ? "" : " (lote " + ref + ")");
        return movimento.lancarComAvisos(new NovoLancamento(data, OrigemLancamento.LIQUIDACAO_CARTAO, null, texto,
                l.linhasConta(cartao, banco), l.linhasCategoria(),
                new Lancamento.Complemento(corrige, ref.isEmpty() ? null : ref, chave)));
    }

    private ResultadoLancamento manual(Long contaId, LocalDate data, TipoCategoria tipo, String categoria,
            BigDecimal valor, String descricao, AnexoLancamento anexo, Lancamento.Complemento complemento) {
        List<ErroCampo> erros = new ArrayList<>();
        exigirData(data, erros);
        if (contaId == null) {
            erros.add(new ErroCampo("contaId", "Escolha a conta."));
        }
        ValidacaoException.lancarSeHouver(erros);
        ContaFinanceira conta = conta(contaId, "contaId");
        if (conta.tipo() == TipoConta.CARTAO_A_RECEBER) {
            throw ValidacaoException.doCampo("contaId", "Escolha um caixa ou uma conta bancária.");
        }
        Categoria cat = categoria == null ? null : categorias.buscar(categoria).orElse(null);
        LancamentoManual m = LancamentoManual.de(tipo, cat, valor, descricao);
        ResultadoLancamento r = movimento.lancarComAvisos(new NovoLancamento(data, OrigemLancamento.MANUAL, null,
                m.descricao(), m.linhasConta(conta), m.linhasCategoria(), complemento));
        if (anexo != null) {
            anexos.salvar(r.id(), anexo);
        }
        return r;
    }

    private Optional<ResultadoLancamento> jaRegistrado(String chave) {
        return Textos.vazio(chave) ? Optional.empty()
                : lancamentos.buscarPorChave(chave.trim()).map(l -> new ResultadoLancamento(l.getId(), List.of()));
    }

    private static String chave(String chave) {
        return Textos.vazio(chave) ? null : chave.trim();
    }

    private void exigirData(LocalDate data, List<ErroCampo> erros) {
        if (data == null) {
            erros.add(new ErroCampo("data", "Informe a data."));
        } else if (data.isAfter(LocalDate.now(relogio))) {
            erros.add(new ErroCampo("data", "A data não pode ser futura."));
        }
    }

    private static String descricao(String informada, String padrao) {
        String texto = Textos.compactar(informada);
        if (texto.length() > LancamentoManual.MAXIMO_DESCRICAO) {
            throw ValidacaoException.doCampo("descricao", "Use até 200 caracteres.");
        }
        return texto.isEmpty() ? padrao : texto;
    }

    private ContaFinanceira conta(long id, String campo) {
        return contas.buscarPorId(id).orElseThrow(() -> ValidacaoException.doCampo(campo, "Conta não encontrada."));
    }

    private Lancamento carregar(long id) {
        return lancamentos.buscarPorId(id).orElseThrow(() -> new RecursoNaoEncontradoException(
                "LANCAMENTO_NAO_ENCONTRADO", "Lançamento não encontrado."));
    }

    private void auditar(String acao, long id) {
        Lancamento l = carregar(id);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("data", l.getDataFinanceira().toString());
        detalhes.put("descricao", l.getDescricao());
        detalhes.put("contas", l.getLinhasConta().stream().map(c -> Map.of("contaId", c.contaId(), "valor", c.valor())).toList());
        detalhes.put("categorias", l.getLinhasCategoria().stream()
                .map(c -> Map.of("categoria", c.categoria(), "valor", c.valor())).toList());
        auditoria.registrar(acao, ENTIDADE, id, detalhes);
    }

    public record ResultadoEstorno(long estornoId, Long correcaoId, List<String> avisos) {
    }
}
