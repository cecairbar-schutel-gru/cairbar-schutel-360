package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.LinhaPagina;
import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.AnexoLancamentoRepository;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ClassificacaoRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import com.durvalcrm.financeiro.domain.OrigemLancamento;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lista e detalhe dos lançamentos (US-FINANCIAL-005), com o histórico de classificação
 * (US-FINANCIAL-021). Com uma conta escolhida, traz o saldo anterior do período, o saldo depois de
 * cada lançamento e o saldo final.
 */
public class ConsultarLancamentosUseCase {

    public static final int POR_PAGINA = 50;

    private final LancamentoRepository lancamentos;
    private final ContaFinanceiraRepository contas;
    private final CategoriaRepository categorias;
    private final ClassificacaoRepository classificacoes;
    private final AnexoLancamentoRepository anexos;
    private final ConsultaFinanceiraPort consulta;
    private final PeriodoFinanceiroPort periodos;

    public ConsultarLancamentosUseCase(LancamentoRepository lancamentos, ContaFinanceiraRepository contas,
            CategoriaRepository categorias, ClassificacaoRepository classificacoes, AnexoLancamentoRepository anexos,
            ConsultaFinanceiraPort consulta, PeriodoFinanceiroPort periodos) {
        this.lancamentos = lancamentos;
        this.contas = contas;
        this.categorias = categorias;
        this.classificacoes = classificacoes;
        this.anexos = anexos;
        this.consulta = consulta;
        this.periodos = periodos;
    }

    @Transactional(readOnly = true)
    public List<Categoria> categorias() {
        return categorias.listar();
    }

    /** O que a subcategoria de despesa já gastou no mês (detalhe da intenção de gasto, US-EXPENSE-002). */
    @Transactional(readOnly = true)
    public BigDecimal despesasNoMes(String categoria, YearMonth mes) {
        return consulta.despesasDaCategoria(categoria, mes.atDay(1), mes.atEndOfMonth());
    }

    /** {@code pagina} começa em zero; 50 linhas por vez. */
    @Transactional(readOnly = true)
    public PaginaLancamentos listar(FiltroLancamentos filtro, int pagina) {
        return montar(filtro, Math.max(pagina, 0) * POR_PAGINA, POR_PAGINA);
    }

    /** Até {@code limite} lançamentos de uma vez, a partir do primeiro (exportação, US-REPORT-021). */
    @Transactional(readOnly = true)
    public PaginaLancamentos listarAte(FiltroLancamentos filtro, int limite) {
        return montar(filtro, 0, limite);
    }

    private PaginaLancamentos montar(FiltroLancamentos filtro, int deslocamento, int limite) {
        if (filtro.de() != null && filtro.ate() != null && filtro.de().isAfter(filtro.ate())) {
            throw ValidacaoException.doCampo("de", "A data inicial deve ser anterior à final.");
        }
        Map<Long, ContaFinanceira> porId = contas.listar().stream()
                .collect(Collectors.toMap(ContaFinanceira::id, Function.identity()));
        Map<String, Categoria> cats = mapaCategorias();
        ContaFinanceira conta = null;
        if (filtro.contaId() != null) {
            conta = porId.get(filtro.contaId());
            if (conta == null) {
                throw ContasFinanceirasUseCase.naoEncontrada();
            }
        }
        List<LinhaPagina> linhas = consulta.pagina(filtro, deslocamento, limite + 1);
        boolean temMais = linhas.size() > limite;
        List<LinhaPagina> visiveis = temMais ? linhas.subList(0, limite) : linhas;
        Map<Long, Lancamento> carregados = lancamentos.buscarTodos(visiveis.stream().map(LinhaPagina::id).toList())
                .stream().collect(Collectors.toMap(Lancamento::getId, Function.identity()));
        Map<Long, Long> estornos = consulta.estornos(carregados.keySet());
        Long contaId = filtro.contaId();
        List<ItemLancamento> itens = visiveis.stream().map(linha -> {
            Lancamento l = carregados.get(linha.id());
            BigDecimal valor = contaId == null ? valorPrincipal(l) : l.valorNaConta(contaId);
            return new ItemLancamento(l.getId(), l.getDataFinanceira(), l.getDescricao(), l.natureza(),
                    l.getOrigemTipo(), l.getOrigemId(),
                    l.getLinhasCategoria().stream().map(c -> nomeCategoria(cats, c.categoria())).distinct().toList(),
                    l.getLinhasConta().stream().map(c -> nomeConta(porId, c.contaId())).distinct().toList(),
                    valor, nomeAutor(l), l.getEstornaLancamentoId(), estornos.get(l.getId()),
                    l.getCorrigeLancamentoId(), linha.conciliado(), linha.saldoApos());
        }).toList();

        BigDecimal saldoAnterior = null;
        BigDecimal saldoFinal = null;
        if (conta != null) {
            // Antes do corte só existe o histórico importado (US-ADMIN-012), que entra quando o período o inclui.
            LocalDate de = filtro.de() == null ? conta.dataCorte() : filtro.de();
            saldoAnterior = consulta.saldoAntesDe(conta.id(), de);
            saldoFinal = saldoAnterior.add(consulta.somaNoPeriodo(conta.id(), de, filtro.ate()));
        }
        return new PaginaLancamentos(conta, itens, temMais, saldoAnterior, saldoFinal);
    }

    @Transactional(readOnly = true)
    public DetalheLancamento detalhe(long id) {
        Lancamento l = lancamentos.buscarPorId(id).orElseThrow(ConsultarLancamentosUseCase::naoEncontrado);
        Map<Long, ContaFinanceira> porId = contas.listar().stream()
                .collect(Collectors.toMap(ContaFinanceira::id, Function.identity()));
        Map<String, Categoria> cats = mapaCategorias();
        Long estornadoPor = consulta.estornos(List.of(id)).get(id);
        boolean estornavel = OrigemLancamento.ESTORNAVEIS_NO_FINANCEIRO.contains(l.getOrigemTipo())
                && l.getEstornaLancamentoId() == null && estornadoPor == null;
        boolean reclassificavel = (l.natureza() == NaturezaLancamento.RECEITA || l.natureza() == NaturezaLancamento.DESPESA)
                && estornadoPor == null && !periodos.estaFechado(YearMonth.from(l.getDataFinanceira()));

        List<LinhaContaDetalhe> linhasConta = l.getLinhasConta().stream().map((LinhaConta c) -> {
            ContaFinanceira conta = porId.get(c.contaId());
            return new LinhaContaDetalhe(c.contaId(), conta == null ? "—" : conta.nome(),
                    conta == null ? null : conta.tipo(), c.valor());
        }).toList();
        List<LinhaCategoria> lc = l.getLinhasCategoria();
        List<LinhaCategoriaDetalhe> linhasCategoria = IntStream.range(0, lc.size()).mapToObj(i -> {
            Categoria c = cats.get(lc.get(i).categoria());
            return new LinhaCategoriaDetalhe(i, lc.get(i).categoria(), nomeCategoria(cats, lc.get(i).categoria()),
                    c == null ? null : c.tipo(), lc.get(i).valor());
        }).toList();
        List<HistoricoClassificacao> historico = classificacoes.historico(id).stream()
                .sorted(Comparator.comparing(r -> r.alteradoEm()))
                .map(r -> new HistoricoClassificacao(r.ordem(), nomeCategoria(cats, r.categoriaAnterior()),
                        nomeCategoria(cats, r.categoriaNova()), r.alteradoPorNome() == null ? r.alteradoPor()
                                : r.alteradoPorNome(), r.alteradoEm(), r.motivo()))
                .toList();
        return new DetalheLancamento(l.getId(), l.getDataFinanceira(), l.getDescricao(), l.natureza(), l.getOrigemTipo(),
                l.getOrigemId(), valorPrincipal(l), nomeAutor(l), l.getCriadoEm(), l.getMotivo(), l.getReferenciaExterna(),
                l.getEstornaLancamentoId(), estornadoPor, l.getCorrigeLancamentoId(), consulta.correcoes(id),
                linhasConta, linhasCategoria, historico, anexos.obter(id).isPresent(), lancamentos.conciliado(id),
                estornavel, reclassificavel);
    }

    @Transactional(readOnly = true)
    public AnexoLancamento anexo(long id) {
        return anexos.obter(id).orElseThrow(() -> new RecursoNaoEncontradoException("ANEXO_NAO_ENCONTRADO",
                "Este lançamento não tem anexo."));
    }

    /**
     * Valor exibido sem conta escolhida: receita ou despesa pela soma das categorias, transferência
     * pelo valor transferido e liquidação pelo bruto; estornos ficam com o sinal invertido.
     */
    static BigDecimal valorPrincipal(Lancamento l) {
        boolean liquidacao = OrigemLancamento.LIQUIDACAO_CARTAO.equals(l.getOrigemTipo());
        if (!l.getLinhasCategoria().isEmpty() && !liquidacao) {
            return l.getLinhasCategoria().stream().map(LinhaCategoria::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        if (liquidacao) {
            return l.getLinhasConta().stream().map(LinhaConta::valor).max(Comparator.comparing(BigDecimal::abs))
                    .orElse(BigDecimal.ZERO).negate();
        }
        BigDecimal transferido = l.getLinhasConta().stream().map(LinhaConta::valor).filter(v -> v.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return l.getEstornaLancamentoId() == null ? transferido : transferido.negate();
    }

    private Map<String, Categoria> mapaCategorias() {
        return categorias.listar().stream().collect(Collectors.toMap(Categoria::codigo, Function.identity()));
    }

    private static String nomeCategoria(Map<String, Categoria> cats, String codigo) {
        Categoria c = cats.get(codigo);
        return c == null ? codigo : c.nomeCompleto();
    }

    private static String nomeConta(Map<Long, ContaFinanceira> contas, long id) {
        ContaFinanceira c = contas.get(id);
        return c == null ? "—" : c.nome();
    }

    private static String nomeAutor(Lancamento l) {
        return l.getCriadoPorNome() == null ? l.getCriadoPor() : l.getCriadoPorNome();
    }

    private static RecursoNaoEncontradoException naoEncontrado() {
        return new RecursoNaoEncontradoException("LANCAMENTO_NAO_ENCONTRADO", "Lançamento não encontrado.");
    }

    public record ItemLancamento(long id, LocalDate data, String descricao, NaturezaLancamento natureza,
            String origemTipo, Long origemId, List<String> categorias, List<String> contas, BigDecimal valor,
            String usuario, Long estornaLancamentoId, Long estornadoPorId, Long corrigeLancamentoId,
            Boolean conciliado, BigDecimal saldoApos) {
    }

    public record PaginaLancamentos(ContaFinanceira conta, List<ItemLancamento> itens, boolean temMais,
            BigDecimal saldoAnterior, BigDecimal saldoFinal) {
    }

    public record LinhaContaDetalhe(long contaId, String contaNome, TipoConta tipoConta, BigDecimal valor) {
    }

    public record LinhaCategoriaDetalhe(int ordem, String codigo, String nome, TipoCategoria tipo, BigDecimal valor) {
    }

    public record HistoricoClassificacao(int ordem, String de, String para, String por, Instant em, String motivo) {
    }

    public record DetalheLancamento(long id, LocalDate data, String descricao, NaturezaLancamento natureza,
            String origemTipo, Long origemId, BigDecimal valor, String usuario, Instant registradoEm, String motivo,
            String referenciaExterna, Long estornaLancamentoId, Long estornadoPorId, Long corrigeLancamentoId,
            List<Long> correcoes, List<LinhaContaDetalhe> linhasConta, List<LinhaCategoriaDetalhe> linhasCategoria,
            List<HistoricoClassificacao> historico, boolean temAnexo, boolean conciliado, boolean podeEstornar,
            boolean podeReclassificar) {
    }
}
