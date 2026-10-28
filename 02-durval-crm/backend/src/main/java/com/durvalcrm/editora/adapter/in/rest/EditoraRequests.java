package com.durvalcrm.editora.adapter.in.rest;

import com.durvalcrm.editora.application.PagarEditoraUseCase.PagamentoCommand;
import com.durvalcrm.editora.application.PedidosLivrosUseCase.NovoPedido;
import com.durvalcrm.editora.application.RemessasUseCase.NovaDevolucao;
import com.durvalcrm.editora.application.RemessasUseCase.NovaRemessa;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** DTOs HTTP de entrada do módulo Editoras; as regras ficam no domínio. */
final class EditoraRequests {

    private EditoraRequests() {
    }

    record EditoraRequest(String nome, String cnpj, String contatoNome, String telefone, String email, String banco,
            String agencia, String conta, String chavePix, String observacoes) {

        Editora.Dados paraDados() {
            return new Editora.Dados(nome, cnpj, contatoNome, telefone, email,
                    new Editora.DadosPagamento(banco, agencia, conta, chavePix), observacoes);
        }
    }

    record ItemRemessaRequest(Long produtoId, Integer quantidade, BigDecimal repassePercentual) {
    }

    record RemessaRequest(Long editoraId, LocalDate recebidaEm, String numeroDocumento, List<ItemRemessaRequest> itens,
            Long pedidoId) {

        NovaRemessa paraComando() {
            return new NovaRemessa(editoraId, recebidaEm, numeroDocumento, itens == null ? List.of()
                    : itens.stream().map(i -> new Remessa.ItemPedido(i.produtoId(), i.quantidade(),
                            i.repassePercentual())).toList(), pedidoId);
        }
    }

    record ItemPedidoLivrosRequest(Long produtoId, Integer quantidade) {
    }

    record PedidoLivrosRequest(Long editoraId, String observacao, List<ItemPedidoLivrosRequest> itens) {

        NovoPedido paraComando() {
            return new NovoPedido(editoraId, observacao, itens == null ? List.of()
                    : itens.stream().map(i -> new PedidoLivros.ItemPedido(i.produtoId(), i.quantidade())).toList());
        }
    }

    record ItemDevolucaoRequest(Long produtoId, Integer quantidade) {
    }

    record DevolucaoRequest(LocalDate devolvidaEm, String observacao, List<ItemDevolucaoRequest> itens) {

        NovaDevolucao paraComando() {
            Map<Long, Integer> quantidades = new LinkedHashMap<>();
            if (itens != null) {
                itens.stream().filter(i -> i.produtoId() != null)
                        .forEach(i -> quantidades.put(i.produtoId(), i.quantidade()));
            }
            return new NovaDevolucao(devolvidaEm, observacao, quantidades);
        }
    }

    record MotivoRequest(String motivo) {
    }

    record PagamentoRequest(Long editoraId, LocalDate pagoEm, BigDecimal valor, Long contaId, MeioPagamentoEditora meio,
            String observacao, String chaveIdempotencia) {

        PagamentoCommand paraComando() {
            return new PagamentoCommand(editoraId, pagoEm, valor, contaId, meio, observacao, chaveIdempotencia);
        }
    }

    record TransferenciaRequest(Long editoraId, String mes, String nota) {
    }

    /** "AAAA-MM"; nulo se não informado. */
    static YearMonth mes(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return YearMonth.parse(valor.trim());
        } catch (DateTimeParseException e) {
            throw ValidacaoException.doCampo("mes", "Informe o mês no formato AAAA-MM.");
        }
    }
}
