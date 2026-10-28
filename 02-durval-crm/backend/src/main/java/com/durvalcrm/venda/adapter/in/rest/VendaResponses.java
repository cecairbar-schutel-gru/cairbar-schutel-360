package com.durvalcrm.venda.adapter.in.rest;

import com.durvalcrm.estoque.domain.Produto;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.venda.application.OpcoesVenda;
import com.durvalcrm.venda.domain.StatusVenda;
import com.durvalcrm.venda.domain.Venda;
import java.math.BigDecimal;

final class VendaResponses {

    private VendaResponses() {
    }

    record ContaResponse(long id, String nome) {
        static ContaResponse de(ContaFinanceira c) {
            return new ContaResponse(c.id(), c.nome());
        }
    }

    /** Conta que recebe cada forma de pagamento; {@code dinheiro} ou {@code pix} nulos se não definidos. */
    record OpcoesVendaResponse(ContaResponse dinheiro, ContaResponse pix, ContaResponse cartaoAReceber) {
        static OpcoesVendaResponse de(OpcoesVenda o) {
            return new OpcoesVendaResponse(o.dinheiro() == null ? null : ContaResponse.de(o.dinheiro()),
                    o.pix() == null ? null : ContaResponse.de(o.pix()), ContaResponse.de(o.cartaoAReceber()));
        }
    }

    /** Resultado da busca do carrinho: nome, tipo, preço vigente e quantidade disponível. */
    record ProdutoVendavelResponse(long id, TipoProduto tipo, String nome, String categoria, String autor, String isbn,
            BigDecimal preco, int disponivel) {
        static ProdutoVendavelResponse de(Produto p) {
            return new ProdutoVendavelResponse(p.id(), p.tipo(), p.nome(), p.categoria(), p.autor(), p.isbn(), p.preco(),
                    p.saldo());
        }
    }

    record VendaRegistradaResponse(long id, long numero, BigDecimal total, StatusVenda status) {
        static VendaRegistradaResponse de(Venda v) {
            return new VendaRegistradaResponse(v.getId(), v.getNumero(), v.total(), v.getStatus());
        }
    }
}
