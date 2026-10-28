package com.durvalcrm.editora.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.PedidoLivrosRepository;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.editora.domain.RemessaRepository;
import com.durvalcrm.editora.domain.StatusPedidoLivros;
import com.durvalcrm.editora.domain.TituloConsignado;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedidos de novos livros às editoras: a Tesouraria pede, o Vendedor recebe a remessa contra o pedido
 * ({@link RemessasUseCase#registrar}) e a página do pedido confere o pedido com o recebido, por título.
 */
public class PedidosLivrosUseCase {

    static final String ENTIDADE = "PedidoLivros";

    private final PedidoLivrosRepository pedidos;
    private final EditoraRepository editoras;
    private final RemessaRepository remessas;
    private final EstoqueConsignadoPort estoque;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public PedidosLivrosUseCase(PedidoLivrosRepository pedidos, EditoraRepository editoras, RemessaRepository remessas,
            EstoqueConsignadoPort estoque, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.pedidos = pedidos;
        this.editoras = editoras;
        this.remessas = remessas;
        this.estoque = estoque;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    public record NovoPedido(Long editoraId, String observacao, List<PedidoLivros.ItemPedido> itens) {
    }

    public record ResumoPedido(long id, long editoraId, String editoraNome, StatusPedidoLivros status,
            Instant pedidoEm, String pedidoPor, int titulos, int unidades, Long remessaId, String remessaCodigo) {
    }

    /** {@code recebida}: nula enquanto o pedido não foi recebido. */
    public record ItemConferido(long produtoId, String titulo, String autor, String isbn, int pedida,
            Integer recebida) {
    }

    public record DetalhePedido(PedidoLivros pedido, String editoraNome, String remessaCodigo,
            List<ItemConferido> itens) {
    }

    static RecursoNaoEncontradoException naoEncontrado() {
        return new RecursoNaoEncontradoException("PEDIDO_NAO_ENCONTRADO", "Pedido de livros não encontrado.");
    }

    @Transactional(readOnly = true)
    public List<ResumoPedido> listar(Long editoraId, String situacao) {
        StatusPedidoLivros status = null;
        if (situacao != null && !situacao.isBlank()) {
            try {
                status = StatusPedidoLivros.valueOf(situacao);
            } catch (IllegalArgumentException e) {
                throw ValidacaoException.doCampo("situacao", "Situação desconhecida.");
            }
        }
        Map<Long, String> nomes = new HashMap<>();
        return pedidos.listar(editoraId, status).stream().map(p -> new ResumoPedido(p.getId(), p.getEditoraId(),
                nomes.computeIfAbsent(p.getEditoraId(), id -> editoras.obter(id).map(Editora::nome).orElse("")),
                p.getStatus(), p.getPedidoEm(), p.getPedidoPor(), p.getItens().size(),
                p.getItens().stream().mapToInt(PedidoLivros.Item::quantidade).sum(), p.getRemessaId(),
                codigoRemessa(p.getRemessaId()))).toList();
    }

    @Transactional(readOnly = true)
    public DetalhePedido detalhe(long id) {
        PedidoLivros p = pedidos.obter(id).orElseThrow(PedidosLivrosUseCase::naoEncontrado);
        Editora e = editoras.obter(p.getEditoraId()).orElseThrow();
        Remessa r = p.getRemessaId() == null ? null : remessas.obter(p.getRemessaId()).orElseThrow();
        Map<Long, Integer> recebidas = r == null ? Map.of()
                : r.getItens().stream().collect(Collectors.toMap(Remessa.Item::produtoId, Remessa.Item::quantidade));
        // Pedidos primeiro, na ordem do pedido; depois os títulos que vieram sem ter sido pedidos.
        Set<Long> ids = new LinkedHashSet<>();
        p.getItens().forEach(i -> ids.add(i.produtoId()));
        ids.addAll(recebidas.keySet());
        Map<Long, TituloConsignado> titulos = estoque.titulos(List.copyOf(ids));
        Map<Long, Integer> pedidas = p.getItens().stream()
                .collect(Collectors.toMap(PedidoLivros.Item::produtoId, PedidoLivros.Item::quantidade));
        List<ItemConferido> itens = ids.stream().map(produto -> {
            TituloConsignado t = titulos.get(produto);
            return new ItemConferido(produto, t == null ? "Título " + produto : t.nome(), t == null ? null : t.autor(),
                    t == null ? null : t.isbn(), pedidas.getOrDefault(produto, 0),
                    r == null ? null : recebidas.getOrDefault(produto, 0));
        }).toList();
        return new DetalhePedido(p, e.nome(), r == null ? null : r.getCodigo(), itens);
    }

    @Transactional
    public PedidoLivros criar(NovoPedido cmd) {
        if (cmd.editoraId() == null) {
            throw ValidacaoException.doCampo("editoraId", "Escolha a editora.");
        }
        Editora editora = editoras.obter(cmd.editoraId()).orElseThrow(() -> ValidacaoException.doCampo("editoraId",
                "Editora não encontrada."));
        Map<Long, TituloConsignado> titulos = estoque.titulosDaEditora(editora.id()).stream()
                .collect(Collectors.toMap(TituloConsignado::produtoId, Function.identity()));
        PedidoLivros salvo = pedidos.salvar(PedidoLivros.novo(editora, cmd.itens(), titulos, cmd.observacao(),
                usuario.getNome(), relogio.instant()));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("editoraId", editora.id());
        detalhes.put("observacao", salvo.getObservacao());
        detalhes.put("itens", salvo.getItens().stream()
                .map(i -> Map.of("produtoId", i.produtoId(), "quantidade", i.quantidade())).toList());
        auditoria.registrar("PEDIDO_LIVROS_CRIADO", ENTIDADE, salvo.getId(), detalhes);
        return salvo;
    }

    @Transactional
    public PedidoLivros cancelar(long id, String motivo) {
        PedidoLivros p = pedidos.travar(id).orElseThrow(PedidosLivrosUseCase::naoEncontrado);
        p.cancelar(motivo, usuario.getNome(), relogio.instant());
        pedidos.salvar(p);
        auditoria.registrar("PEDIDO_LIVROS_CANCELADO", ENTIDADE, id, Map.of("motivo", p.getMotivoCancelamento()));
        return p;
    }

    private String codigoRemessa(Long remessaId) {
        return remessaId == null ? null : remessas.obter(remessaId).map(Remessa::getCodigo).orElse(null);
    }
}
