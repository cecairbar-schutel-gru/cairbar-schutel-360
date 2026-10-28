package com.durvalcrm.venda.application;

import com.durvalcrm.estoque.application.EstoqueParaVendaUseCase;
import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.util.List;

/**
 * Busca do carrinho (US-SALES-002): produtos ativos com preço vigente e saldo disponível. O PDV da
 * cantina vende também os livros cadastrados, inclusive pelo perfil PDV.
 */
public class CatalogoVendaUseCase {

    private final EstoqueParaVendaUseCase estoque;
    private final CurrentUserPort usuario;

    public CatalogoVendaUseCase(EstoqueParaVendaUseCase estoque, CurrentUserPort usuario) {
        this.estoque = estoque;
        this.usuario = usuario;
    }

    public List<Produto> buscar(String termo, TipoProduto tipo) {
        return estoque.buscar(termo, tipo);
    }

    /** Quem só tem o perfil PDV opera só o PDV (cantina e livros); a venda fica marcada como do PDV. */
    static boolean somentePdv(CurrentUserPort usuario) {
        return !usuario.hasRole("vendedor");
    }
}
