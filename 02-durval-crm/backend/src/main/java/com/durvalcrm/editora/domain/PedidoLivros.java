package com.durvalcrm.editora.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Pedido de novos livros a uma editora, feito pela Tesouraria (Tesoureiro ou Administrador). Consignado
 * não gera despesa: o pedido só registra o que se espera receber. O Vendedor registra a remessa contra
 * ele, conferindo as quantidades; cancelar essa remessa reabre o pedido.
 */
public final class PedidoLivros {

    public static final int MAXIMO_OBSERVACAO = 500;

    public record Item(long produtoId, int quantidade) {
    }

    /** Linha do formulário. */
    public record ItemPedido(Long produtoId, Integer quantidade) {
    }

    private final Long id;
    private final long editoraId;
    private StatusPedidoLivros status;
    private final List<Item> itens;
    private final String observacao;
    private final Instant pedidoEm;
    private final String pedidoPor;
    private Long remessaId;
    private Instant canceladoEm;
    private String canceladoPor;
    private String motivoCancelamento;

    private PedidoLivros(Long id, long editoraId, StatusPedidoLivros status, List<Item> itens, String observacao,
            Instant pedidoEm, String pedidoPor, Long remessaId, Instant canceladoEm, String canceladoPor,
            String motivoCancelamento) {
        this.id = id;
        this.editoraId = editoraId;
        this.status = Objects.requireNonNull(status);
        this.itens = List.copyOf(itens);
        this.observacao = observacao;
        this.pedidoEm = pedidoEm;
        this.pedidoPor = pedidoPor;
        this.remessaId = remessaId;
        this.canceladoEm = canceladoEm;
        this.canceladoPor = canceladoPor;
        this.motivoCancelamento = motivoCancelamento;
    }

    /** {@code titulos}: livros da editora, por id do produto. */
    public static PedidoLivros novo(Editora editora, List<ItemPedido> pedidos, Map<Long, TituloConsignado> titulos,
            String observacao, String autor, Instant agora) {
        editora.exigirAtivaParaRemessa();
        List<ErroCampo> erros = new ArrayList<>();
        String texto = Textos.compactar(observacao);
        if (texto.length() > MAXIMO_OBSERVACAO) {
            erros.add(new ErroCampo("observacao", "Use até 500 caracteres."));
        }
        List<Item> itens = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        if (pedidos == null || pedidos.isEmpty()) {
            erros.add(new ErroCampo("itens", "Inclua ao menos um título."));
        } else {
            for (ItemPedido p : pedidos) {
                Item item = item(p, titulos, editora, vistos, erros);
                if (item != null) {
                    itens.add(item);
                }
            }
        }
        ValidacaoException.lancarSeHouver(erros);
        return new PedidoLivros(null, editora.id(), StatusPedidoLivros.ABERTO, itens, texto.isEmpty() ? null : texto,
                agora, autor, null, null, null, null);
    }

    private static Item item(ItemPedido p, Map<Long, TituloConsignado> titulos, Editora editora, Set<Long> vistos,
            List<ErroCampo> erros) {
        if (p.produtoId() == null) {
            erros.add(new ErroCampo("itens", "Escolha o título de cada linha."));
            return null;
        }
        String campo = "itens[" + p.produtoId() + "]";
        TituloConsignado t = titulos.get(p.produtoId());
        if (t == null || !Objects.equals(t.editoraId(), editora.id())) {
            erros.add(new ErroCampo(campo, "O título não é da editora " + editora.nome() + "."));
            return null;
        }
        if (!vistos.add(p.produtoId())) {
            erros.add(new ErroCampo(campo, t.nome() + " aparece mais de uma vez."));
            return null;
        }
        if (!t.ativo()) {
            erros.add(new ErroCampo(campo, t.nome() + " está inativo."));
            return null;
        }
        if (p.quantidade() == null || p.quantidade() <= 0) {
            erros.add(new ErroCampo(campo, "Informe a quantidade de " + t.nome() + " (maior que zero)."));
            return null;
        }
        return new Item(p.produtoId(), p.quantidade());
    }

    public static PedidoLivros reconstituir(Long id, long editoraId, StatusPedidoLivros status, List<Item> itens,
            String observacao, Instant pedidoEm, String pedidoPor, Long remessaId, Instant canceladoEm,
            String canceladoPor, String motivoCancelamento) {
        return new PedidoLivros(id, editoraId, status, itens, observacao, pedidoEm, pedidoPor, remessaId, canceladoEm,
                canceladoPor, motivoCancelamento);
    }

    /** Antes de gravar a remessa: o pedido precisa estar aberto e ser da mesma editora. */
    public void exigirRecebivelPor(long editoraDaRemessa) {
        exigirAberto();
        if (editoraDaRemessa != editoraId) {
            throw ValidacaoException.doCampo("pedidoId", "O pedido é de outra editora.");
        }
    }

    /** A remessa registrada contra o pedido o encerra; as quantidades podem divergir e ficam à mostra. */
    public void receber(Remessa remessa) {
        exigirRecebivelPor(remessa.getEditoraId());
        status = StatusPedidoLivros.RECEBIDO;
        remessaId = remessa.getId();
    }

    /** A remessa recebida foi cancelada (erro de registro): o pedido volta a esperar a entrega. */
    public void reabrir() {
        if (status == StatusPedidoLivros.RECEBIDO) {
            status = StatusPedidoLivros.ABERTO;
            remessaId = null;
        }
    }

    public void cancelar(String motivo, String autor, Instant agora) {
        exigirAberto();
        String texto = Textos.compactar(motivo);
        if (texto.isEmpty()) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo do cancelamento.");
        }
        if (texto.length() > MAXIMO_OBSERVACAO) {
            throw ValidacaoException.doCampo("motivo", "Use até 500 caracteres.");
        }
        status = StatusPedidoLivros.CANCELADO;
        motivoCancelamento = texto;
        canceladoPor = autor;
        canceladoEm = agora;
    }

    private void exigirAberto() {
        if (status != StatusPedidoLivros.ABERTO) {
            throw new RegraDeNegocioException("PEDIDO_NAO_ABERTO", status == StatusPedidoLivros.RECEBIDO
                    ? "Este pedido já foi recebido." : "Este pedido foi cancelado.");
        }
    }

    public Long getId() { return id; }
    public long getEditoraId() { return editoraId; }
    public StatusPedidoLivros getStatus() { return status; }
    public List<Item> getItens() { return itens; }
    public String getObservacao() { return observacao; }
    public Instant getPedidoEm() { return pedidoEm; }
    public String getPedidoPor() { return pedidoPor; }
    public Long getRemessaId() { return remessaId; }
    public Instant getCanceladoEm() { return canceladoEm; }
    public String getCanceladoPor() { return canceladoPor; }
    public String getMotivoCancelamento() { return motivoCancelamento; }
}
