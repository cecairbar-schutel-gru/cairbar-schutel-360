package com.durvalcrm.intencaogasto.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.estoque.application.ConsultarEstoqueUseCase;
import com.durvalcrm.estoque.application.ItemEstoque;
import com.durvalcrm.estoque.application.SituacaoCatalogo;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.intencaogasto.application.Comandos.ItemPedido;
import com.durvalcrm.intencaogasto.application.Comandos.NovaIntencao;
import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort.ResumoIntencao;
import com.durvalcrm.intencaogasto.application.OpcoesIntencao.CategoriaOpcao;
import com.durvalcrm.intencaogasto.application.OpcoesIntencao.ContaOpcao;
import com.durvalcrm.intencaogasto.application.OpcoesIntencao.ProdutoOpcao;
import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.Autor;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.intencaogasto.domain.ItemCompra;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lado do Vendedor: nova intenção (US-EXPENSE-001), "Minhas intenções" com destaque do que mudou
 * desde a última visita (US-EXPENSE-008) e desistência enquanto pendente (US-EXPENSE-009). Também as
 * opções dos formulários.
 */
public class SolicitarGastoUseCase {

    private final IntencaoGastoRepository repositorio;
    private final ConsultaIntencoesPort consulta;
    private final Intencoes intencoes;
    private final ConsultarLancamentosUseCase financeiro;
    private final MovimentoFinanceiroUseCase movimento;
    private final ConsultarEstoqueUseCase estoque;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public SolicitarGastoUseCase(IntencaoGastoRepository repositorio, ConsultaIntencoesPort consulta,
            ConsultarLancamentosUseCase financeiro, MovimentoFinanceiroUseCase movimento,
            ConsultarEstoqueUseCase estoque, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.repositorio = repositorio;
        this.consulta = consulta;
        this.intencoes = new Intencoes(repositorio, financeiro, movimento, usuario, relogio);
        this.financeiro = financeiro;
        this.movimento = movimento;
        this.estoque = estoque;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** Subcategorias e produtos; as contas de origem só para quem aprova. */
    @Transactional(readOnly = true)
    public OpcoesIntencao opcoes() {
        List<Categoria> todas = financeiro.categorias();
        List<Categoria> subs = todas.stream().filter(IntencaoGasto::categoriaDisponivel).toList();
        List<CategoriaOpcao> categorias = todas.stream()
                .filter(c -> !c.subcategoria() && subs.stream().anyMatch(s -> s.categoriaPai().equals(c.codigo())))
                .flatMap(mae -> Stream.concat(Stream.of(mae), subs.stream().filter(s -> s.categoriaPai().equals(mae.codigo()))))
                .map(c -> new CategoriaOpcao(c.codigo(), c.nome(), c.categoriaPai(), c.nomeCompleto(),
                        IntencaoGasto.compraDaCantina(c.codigo())))
                .toList();
        List<ProdutoOpcao> produtos = produtosDaCantina().values().stream()
                .map(p -> new ProdutoOpcao(p.id(), p.nome(), p.categoria())).toList();
        List<ContaOpcao> contas = List.of();
        if (usuario.hasRole("tesoureiro") || usuario.hasRole("administrador")) {
            contas = Stream.of(TipoConta.CAIXA, TipoConta.BANCO)
                    .flatMap(t -> movimento.contasAtivas(t).stream())
                    .map(c -> new ContaOpcao(c.id(), c.nome(), c.tipo().name(), movimento.saldo(c.id())))
                    .toList();
        }
        return new OpcoesIntencao(categorias, produtos, contas);
    }

    @Transactional
    public IntencaoGasto criar(NovaIntencao cmd) {
        List<AnexoIntencao> anexos = cmd.anexos() == null ? List.of() : cmd.anexos();
        AnexoIntencao.exigirQuantidade(anexos);
        Autor autor = intencoes.autor();
        IntencaoGasto nova = IntencaoGasto.nova(cmd.descricao(), intencoes.categoria(cmd.categoria()).orElse(null),
                cmd.valor(), cmd.justificativa(), itens(cmd.itens()), autor);
        IntencaoGasto salva = repositorio.salvar(nova);
        repositorio.salvarAnexos(salva.getId(), anexos, autor.em());
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("descricao", salva.getDescricao());
        detalhes.put("categoria", salva.getCategoria());
        detalhes.put("valor", salva.getValorSolicitado());
        detalhes.put("itens", salva.getItens().stream()
                .map(i -> Map.of("produtoId", i.produtoId(), "quantidade", i.quantidade())).toList());
        detalhes.put("anexos", anexos.stream().map(AnexoIntencao::nome).toList());
        auditoria.registrar("INTENCAO_GASTO_CRIADA", Intencoes.ENTIDADE, salva.getId(), detalhes);
        return salva;
    }

    /** US-EXPENSE-009. */
    @Transactional
    public IntencaoGasto retirar(long id, String motivo) {
        IntencaoGasto i = intencoes.travar(id);
        if (!i.getSolicitante().equals(usuario.getSubject())) {
            throw Intencoes.naoEncontrada();
        }
        i.retirar(motivo, intencoes.autor());
        repositorio.salvar(i);
        auditoria.registrar("INTENCAO_GASTO_RETIRADA", Intencoes.ENTIDADE, id, Map.of("motivo", i.getMotivoCancelamento()));
        return i;
    }

    /**
     * US-EXPENSE-008: as do usuário, das mais novas para as mais antigas. {@code novidade}: a situação
     * mudou (por uma decisão, recebimento ou cancelamento) depois da última visita.
     */
    @Transactional(readOnly = true)
    public List<MinhaIntencao> minhas(StatusIntencao status) {
        Instant visita = consulta.ultimaVisita(usuario.getSubject()).orElse(null);
        return consulta.listar(status == null ? List.of() : List.of(status), usuario.getSubject(), false).stream()
                .map(r -> new MinhaIntencao(r, visita != null && r.status() != StatusIntencao.PENDENTE
                        && r.statusAlteradoEm().isAfter(visita)))
                .toList();
    }

    @Transactional
    public void registrarVisita() {
        consulta.registrarVisita(usuario.getSubject(), relogio.instant());
    }

    private List<ItemCompra> itens(List<ItemPedido> pedidos) {
        if (pedidos == null || pedidos.isEmpty()) {
            return List.of();
        }
        Map<Long, ItemEstoque> cantina = produtosDaCantina();
        List<ErroCampo> erros = new ArrayList<>();
        List<ItemCompra> itens = new ArrayList<>();
        for (ItemPedido p : pedidos) {
            if (p.produtoId() == null || p.quantidade() == null) {
                erros.add(new ErroCampo("itens", "Informe o produto e a quantidade de cada item."));
                continue;
            }
            ItemEstoque produto = cantina.get(p.produtoId());
            if (produto == null) {
                erros.add(new ErroCampo("itens[" + p.produtoId() + "]", "Escolha um produto ativo da cantina."));
                continue;
            }
            itens.add(ItemCompra.pedido(produto.id(), produto.nome(), p.quantidade()));
        }
        ValidacaoException.lancarSeHouver(erros);
        return itens;
    }

    private Map<Long, ItemEstoque> produtosDaCantina() {
        return estoque.listar(TipoProduto.CANTINA, null, "", false, SituacaoCatalogo.ATIVOS).stream()
                .collect(Collectors.toMap(ItemEstoque::id, Function.identity(), (a, b) -> a, LinkedHashMap::new));
    }

    public record MinhaIntencao(ResumoIntencao intencao, boolean novidade) {
    }
}
