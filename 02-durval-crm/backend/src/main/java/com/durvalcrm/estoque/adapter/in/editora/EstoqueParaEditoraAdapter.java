package com.durvalcrm.estoque.adapter.in.editora;

import com.durvalcrm.editora.application.EstoqueConsignadoPort;
import com.durvalcrm.editora.domain.TituloConsignado;
import com.durvalcrm.estoque.domain.CatalogoRepository;
import com.durvalcrm.estoque.domain.EstoqueRepository;
import com.durvalcrm.estoque.domain.Lote;
import com.durvalcrm.estoque.domain.MovimentoEstoque;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.TipoMovimento;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Entrega ao módulo Editoras os títulos do catálogo e as unidades consignadas das remessas: entrada,
 * devolução e estorno da entrada de remessa cancelada. Fica no Estoque para que Editoras nunca
 * dependa dele (ver {@code ArquiteturaTest}). As transações são do chamador.
 */
@Component
class EstoqueParaEditoraAdapter implements EstoqueConsignadoPort {

    static final String REFERENCIA_REMESSA = "REMESSA";
    static final String REFERENCIA_DEVOLUCAO = "DEVOLUCAO_EDITORA";

    private final CatalogoRepository catalogo;
    private final EstoqueRepository estoque;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    EstoqueParaEditoraAdapter(CatalogoRepository catalogo, EstoqueRepository estoque, CurrentUserPort usuario,
            Clock relogio) {
        this.catalogo = catalogo;
        this.estoque = estoque;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Override
    public List<TituloConsignado> titulosDaEditora(long editoraId) {
        return catalogo.livrosDaEditora(editoraId).stream().map(EstoqueParaEditoraAdapter::titulo).toList();
    }

    @Override
    public Map<Long, TituloConsignado> titulos(Collection<Long> produtoIds) {
        Map<Long, TituloConsignado> mapa = new LinkedHashMap<>();
        for (Long id : produtoIds) {
            catalogo.obter(id).filter(p -> p.getTipo() == TipoProduto.LIVRO).ifPresent(p -> mapa.put(id, titulo(p)));
        }
        return mapa;
    }

    @Override
    public void entrarRemessa(long remessaId, long produtoId, int quantidade) {
        estoque.travarLotes(produtoId);
        estoque.ajustarLote(produtoId, remessaId, quantidade);
        estoque.registrar(MovimentoEstoque.novo(produtoId, remessaId, TipoMovimento.ENTRADA_REMESSA, quantidade,
                relogio.instant(), usuario.getSubject(), usuario.getNome(), REFERENCIA_REMESSA, remessaId));
    }

    @Override
    public Map<Long, Integer> travarSaldos(long remessaId, Collection<Long> produtoIds) {
        Map<Long, Integer> saldos = new LinkedHashMap<>();
        for (Long id : produtoIds.stream().sorted().toList()) {
            saldos.put(id, estoque.travarLotes(id).stream().filter(l -> Long.valueOf(remessaId).equals(l.remessaId()))
                    .mapToInt(Lote::quantidade).sum());
        }
        return saldos;
    }

    @Override
    public void devolver(long remessaId, long produtoId, int quantidade, long devolucaoId) {
        estoque.ajustarLote(produtoId, remessaId, -quantidade);
        estoque.registrar(MovimentoEstoque.novo(produtoId, remessaId, TipoMovimento.DEVOLUCAO_EDITORA, -quantidade,
                relogio.instant(), usuario.getSubject(), usuario.getNome(), REFERENCIA_DEVOLUCAO, devolucaoId));
    }

    @Override
    public boolean houveMovimentoAlemDaEntrada(long remessaId) {
        return estoque.movimentosDaRemessa(remessaId).stream().anyMatch(m -> m.tipo() != TipoMovimento.ENTRADA_REMESSA);
    }

    /**
     * Estorna cada movimento de entrada. Remessa incluída por SQL, sem movimento de entrada, tem o
     * saldo zerado por ajuste.
     */
    @Override
    public void cancelarEntrada(long remessaId, Collection<Long> produtoIds) {
        Instant agora = relogio.instant();
        List<MovimentoEstoque> entradas = estoque.movimentosDaRemessa(remessaId).stream()
                .filter(m -> m.tipo() == TipoMovimento.ENTRADA_REMESSA).toList();
        Set<Long> comEntrada = entradas.stream().map(MovimentoEstoque::produtoId).collect(Collectors.toSet());
        for (MovimentoEstoque m : entradas) {
            MovimentoEstoque estorno = m.estorno(agora, usuario.getSubject(), usuario.getNome());
            estoque.ajustarLote(m.produtoId(), remessaId, estorno.quantidade());
            estoque.registrar(estorno);
        }
        for (Long produtoId : produtoIds) {
            if (comEntrada.contains(produtoId)) {
                continue;
            }
            int saldo = travarSaldos(remessaId, List.of(produtoId)).get(produtoId);
            if (saldo > 0) {
                estoque.ajustarLote(produtoId, remessaId, -saldo);
                estoque.registrar(MovimentoEstoque.novo(produtoId, remessaId, TipoMovimento.AJUSTE, -saldo, agora,
                        usuario.getSubject(), usuario.getNome(), REFERENCIA_REMESSA, remessaId));
            }
        }
    }

    private static TituloConsignado titulo(ProdutoCatalogo p) {
        return new TituloConsignado(p.getId(), p.getNome(), p.getAutor(), p.getIsbn(), p.getEditoraId(),
                p.getRepassePadrao(), p.isAtivo());
    }
}
