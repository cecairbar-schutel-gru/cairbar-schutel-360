package com.durvalcrm.estoque.adapter.in.rest;

import com.durvalcrm.estoque.application.NovaBaixaCommand;
import com.durvalcrm.estoque.domain.DadosLivro;
import com.durvalcrm.estoque.domain.FotoSolicitacao;
import com.durvalcrm.estoque.domain.ItemEntrada;
import com.durvalcrm.estoque.domain.MotivoBaixa;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.util.Base64;
import java.util.List;

/** DTOs HTTP de entrada do módulo Estoque; as regras ficam no domínio. */
final class EstoqueRequests {

    private EstoqueRequests() {
    }

    record LivroRequest(String titulo, String autor, String isbn, Long editoraId, BigDecimal repassePadrao,
            BigDecimal preco) {

        DadosLivro paraDados() {
            return new DadosLivro(titulo, autor, isbn, editoraId, repassePadrao);
        }
    }

    record CantinaRequest(String nome, String categoria, BigDecimal preco) {
    }

    record PrecoRequest(BigDecimal preco, String motivo) {
    }

    record MotivoRequest(String motivo) {
    }

    record ItemEntradaRequest(Long produtoId, Integer quantidade) {
    }

    record EntradaDoacaoRequest(List<ItemEntradaRequest> itens, String observacao) {

        List<ItemEntrada> paraItens() {
            if (itens == null) {
                return List.of();
            }
            for (ItemEntradaRequest i : itens) {
                if (i.produtoId() == null || i.quantidade() == null) {
                    throw ValidacaoException.doCampo("itens", "Informe o produto e a quantidade de cada item.");
                }
            }
            return itens.stream().map(i -> new ItemEntrada(i.produtoId(), i.quantidade())).toList();
        }
    }

    /** Foto em Base64 (JPG ou PNG de até 5 MB). */
    record FotoRequest(String conteudoBase64, String tipo) {

        FotoSolicitacao paraFoto() {
            try {
                return new FotoSolicitacao(Base64.getDecoder().decode(conteudoBase64 == null ? "" : conteudoBase64),
                        tipo);
            } catch (IllegalArgumentException e) {
                throw ValidacaoException.doCampo("foto", "Não foi possível ler a foto.");
            }
        }
    }

    record BaixaRequest(Long produtoId, Long remessaId, Integer quantidade, MotivoBaixa motivo, String justificativa,
            FotoRequest foto) {

        NovaBaixaCommand paraComando() {
            return new NovaBaixaCommand(produtoId, remessaId, quantidade, motivo, justificativa,
                    foto == null ? null : foto.paraFoto());
        }
    }

    record SolicitacaoPrecoRequest(Long produtoId, BigDecimal novoPreco, String motivo) {
    }

    record SolicitacaoInativacaoRequest(Long produtoId, String motivo) {
    }

    record AjusteRequest(Long remessaId, Integer quantidadeContada, String motivo) {
    }
}
