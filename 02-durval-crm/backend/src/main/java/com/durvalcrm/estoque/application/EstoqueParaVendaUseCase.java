package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.Lote;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.estoque.domain.ProdutoRepository;
import com.durvalcrm.estoque.domain.Retirada;
import com.durvalcrm.estoque.domain.SaidaDeEstoque;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.Textos;
import java.time.Clock;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeSet;
import org.springframework.transaction.annotation.Transactional;

/**
 * API do módulo Estoque para as Vendas: catálogo vendável, saldo, saída por FIFO e devolução no
 * cancelamento. As transações de escrita são abertas pelo caso de uso chamador.
 */
public class EstoqueParaVendaUseCase {

    public static final String REFERENCIA_VENDA = "VENDA";
    public static final int LIMITE_BUSCA = 30;

    private final ProdutoRepository produtos;
    private final EstoqueRepository estoque;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public EstoqueParaVendaUseCase(ProdutoRepository produtos, EstoqueRepository estoque, CurrentUserPort usuario,
            Clock relogio) {
        this.produtos = produtos;
        this.estoque = estoque;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** Produtos ativos, inclusive sem saldo (a tela os mostra desabilitados). */
    @Transactional(readOnly = true)
    public List<Produto> buscar(String termo, TipoProduto tipo) {
        String compacto = termo == null ? "" : termo.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        String isbn = compacto.matches("\\d{9}[\\dX]|\\d{13}") ? compacto : null;
        return produtos.buscarAtivos(Textos.normalizar(termo), isbn, tipo, LIMITE_BUSCA);
    }

    @Transactional(readOnly = true)
    public List<Produto> consultar(Collection<Long> ids) {
        return produtos.buscarPorIds(ids);
    }

    /**
     * Trava os lotes dos produtos (em ordem de id, para não haver impasse entre duas vendas) e
     * devolve o saldo de cada um no momento da confirmação.
     */
    @Transactional
    public Map<Long, Integer> travarSaldos(Collection<Long> produtoIds) {
        Map<Long, Integer> saldos = new LinkedHashMap<>();
        for (long id : new TreeSet<>(produtoIds)) {
            saldos.put(id, SaidaDeEstoque.saldo(estoque.travarLotes(id)));
        }
        return saldos;
    }

    /** Tira as unidades na ordem de saída e registra um movimento "Venda" por lote. */
    @Transactional
    public List<Retirada> retirarParaVenda(long produtoId, int quantidade, long vendaId) {
        List<Lote> lotes = estoque.travarLotes(produtoId);
        List<Retirada> retiradas = SaidaDeEstoque.retirar(lotes, quantidade);
        for (Retirada r : retiradas) {
            estoque.ajustarLote(produtoId, r.remessaId(), -r.quantidade());
            estoque.registrar(MovimentoEstoque.novo(produtoId, r.remessaId(), TipoMovimento.VENDA, -r.quantidade(),
                    relogio.instant(), usuario.getSubject(), usuario.getNome(), REFERENCIA_VENDA, vendaId));
        }
        return retiradas;
    }

    /** Devolve as unidades ao mesmo lote de onde saíram (US-SALES-009). */
    @Transactional
    public void devolverDeVenda(long produtoId, Long remessaId, int quantidade, long vendaId) {
        estoque.ajustarLote(produtoId, remessaId, quantidade);
        estoque.registrar(MovimentoEstoque.novo(produtoId, remessaId, TipoMovimento.CANCELAMENTO_VENDA, quantidade,
                relogio.instant(), usuario.getSubject(), usuario.getNome(), REFERENCIA_VENDA, vendaId));
    }
}
