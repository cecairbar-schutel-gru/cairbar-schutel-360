package com.durvalcrm.estoque.adapter.in.rest;

import com.durvalcrm.estoque.domain.EntradaDoacao;
import com.durvalcrm.estoque.domain.ProdutoCatalogo;
import com.durvalcrm.estoque.domain.Solicitacao;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import java.math.BigDecimal;
import java.time.Instant;

final class EstoqueResponses {

    private EstoqueResponses() {
    }

    record ProdutoResponse(long id, TipoProduto tipo, String nome, String categoria, String autor, String isbn,
            Long editoraId, BigDecimal preco, BigDecimal repassePadrao, boolean ativo) {

        static ProdutoResponse de(ProdutoCatalogo p) {
            return new ProdutoResponse(p.getId(), p.getTipo(), p.getNome(), p.getCategoria(), p.getAutor(), p.getIsbn(),
                    p.getEditoraId(), p.getPreco(), p.getRepassePadrao(), p.isAtivo());
        }
    }

    record SolicitacaoRegistradaResponse(long id, TipoSolicitacao tipo, StatusSolicitacao status, boolean autoAprovada) {

        static SolicitacaoRegistradaResponse de(Solicitacao s) {
            return new SolicitacaoRegistradaResponse(s.getId(), s.getTipo(), s.getStatus(), s.autoAprovada());
        }
    }

    record EntradaRegistradaResponse(long id, Instant registradaEm, boolean cancelada) {

        static EntradaRegistradaResponse de(EntradaDoacao e) {
            return new EntradaRegistradaResponse(e.getId(), e.getRegistradaEm(), e.cancelada());
        }
    }
}
