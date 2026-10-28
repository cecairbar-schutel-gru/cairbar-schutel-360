package com.durvalcrm.editora.adapter.in.rest;

import com.durvalcrm.editora.application.CadastroEditorasUseCase.DetalheEditora;
import com.durvalcrm.editora.application.ConsultaEditorasPort.EstoqueRemessa;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ItemRemessaDetalhado;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaDevolucao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaObrigacao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaPagamento;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoRemessa;
import com.durvalcrm.editora.application.ConsultaEditorasPort.UltimoPagamento;
import com.durvalcrm.editora.application.PagarEditoraUseCase.LinhaAlocacao;
import com.durvalcrm.editora.application.PagarEditoraUseCase.Recibo;
import com.durvalcrm.editora.application.PedidosLivrosUseCase.DetalhePedido;
import com.durvalcrm.editora.application.PedidosLivrosUseCase.ItemConferido;
import com.durvalcrm.editora.application.RemessasUseCase.DetalheDevolucao;
import com.durvalcrm.editora.application.RemessasUseCase.DetalheRemessa;
import com.durvalcrm.editora.application.RemessasUseCase.ItemDevolvido;
import com.durvalcrm.editora.application.SaldosEditorasUseCase.Apuracao;
import com.durvalcrm.editora.application.SaldosEditorasUseCase.SaldoDetalhado;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.PagamentoEditora;
import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.editora.domain.StatusPedidoLivros;
import com.durvalcrm.editora.domain.TransferenciaSaldo;
import com.durvalcrm.shared.application.DadosOrganizacao;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/** DTOs HTTP de saída do módulo Editoras. */
final class EditoraResponses {

    private EditoraResponses() {
    }

    record EditoraResponse(long id, String nome, String cnpj, String contatoNome, String telefone, String email,
            String banco, String agencia, String conta, String chavePix, String observacoes, boolean ativa) {

        static EditoraResponse de(Editora e) {
            return new EditoraResponse(e.id(), e.nome(), e.cnpj(), e.contatoNome(), e.telefone(), e.email(),
                    e.pagamento().banco(), e.pagamento().agencia(), e.pagamento().conta(), e.pagamento().chavePix(),
                    e.observacoes(), e.ativa());
        }
    }

    record DetalheEditoraResponse(EditoraResponse editora, boolean possuiRemessas, BigDecimal saldoDevido,
            UltimoPagamento ultimoPagamento, List<ResumoRemessa> remessasAbertas) {

        static DetalheEditoraResponse de(DetalheEditora d) {
            return new DetalheEditoraResponse(EditoraResponse.de(d.editora()), d.possuiRemessas(), d.saldoDevido(),
                    d.ultimoPagamento(), d.remessasAbertas());
        }
    }

    record DevolucaoResponse(long id, long remessaId, String remessaCodigo, long editoraId, String editoraNome,
            String editoraCnpj, LocalDate devolvidaEm, String observacao, Instant registradaEm, String registradaPor,
            List<ItemDevolvido> itens, DadosOrganizacao organizacao) {

        static DevolucaoResponse de(DetalheDevolucao d) {
            return new DevolucaoResponse(d.devolucao().id(), d.devolucao().remessaId(), d.remessaCodigo(), d.editoraId(),
                    d.editoraNome(), d.editoraCnpj(), d.devolucao().devolvidaEm(), d.devolucao().observacao(),
                    d.devolucao().registradaEm(), d.devolucao().registradaPor(), d.itens(), d.organizacao());
        }
    }

    record RemessaResponse(long id, String codigo, long editoraId, String editoraNome, LocalDate recebidaEm,
            String numeroDocumento, String situacao, Instant registradaEm, String registradaPor, Instant canceladaEm,
            String canceladaPor, String motivoCancelamento, List<ItemRemessaDetalhado> itens,
            List<DevolucaoResponse> devolucoes, boolean podeCancelar, boolean podeDevolver) {

        static RemessaResponse de(DetalheRemessa d) {
            Remessa r = d.remessa();
            return new RemessaResponse(r.getId(), r.getCodigo(), r.getEditoraId(), d.editoraNome(), r.getRecebidaEm(),
                    r.getNumeroDocumento(), d.situacao(), r.getRegistradaEm(), r.getRegistradaPor(), r.getCanceladaEm(),
                    r.getCanceladaPor(), r.getMotivoCancelamento(), d.itens(),
                    d.devolucoes().stream().map(DevolucaoResponse::de).toList(), d.podeCancelar(), d.podeDevolver());
        }
    }

    /** Resposta da gravação de remessa, cancelamento e devolução. */
    record AcaoResponse(long id, String codigo) {
    }

    record ReciboResponse(long id, long editoraId, String editoraNome, String editoraCnpj, LocalDate pagoEm,
            BigDecimal valor, BigDecimal creditoAplicado, String contaNome, MeioPagamentoEditora meio,
            String observacao, Long lancamentoId, Instant registradoEm, String registradoPor, Instant estornadoEm,
            List<LinhaAlocacao> alocacoes, DadosOrganizacao organizacao) {

        static ReciboResponse de(Recibo r) {
            PagamentoEditora p = r.pagamento();
            return new ReciboResponse(p.getId(), p.getEditoraId(), r.editoraNome(), r.editoraCnpj(), p.getPagoEm(),
                    p.getValor(), p.getCreditoAplicado(), p.getContaNome(), p.getMeio(), p.getObservacao(),
                    p.getLancamentoId(), p.getRegistradoEm(), p.getRegistradoPor(), p.getEstornadoEm(), r.alocacoes(),
                    r.organizacao());
        }
    }

    record SaldoDetalhadoResponse(EditoraResponse editora, BigDecimal totalObrigacoes, BigDecimal totalEstornos,
            BigDecimal totalPagamentos, BigDecimal saldoDevido, BigDecimal creditoDisponivel,
            List<LinhaObrigacao> obrigacoes, List<LinhaPagamento> pagamentos) {

        static SaldoDetalhadoResponse de(SaldoDetalhado s) {
            return new SaldoDetalhadoResponse(EditoraResponse.de(s.editora()), s.totalObrigacoes(), s.totalEstornos(),
                    s.totalPagamentos(), s.saldoDevido(), s.creditoDisponivel(), s.obrigacoes(), s.pagamentos());
        }
    }

    record ApuracaoResponse(DadosOrganizacao organizacao, EditoraResponse editora, YearMonth mes,
            BigDecimal saldoInicial, TransferenciaSaldo transferenciaAnterior, BigDecimal obrigacoesVendas,
            BigDecimal obrigacoesBaixas, BigDecimal estornos, BigDecimal pagamentos, BigDecimal saldoFinal,
            List<EstoqueRemessa> estoque, List<LinhaObrigacao> vendas, List<LinhaObrigacao> baixas,
            List<LinhaObrigacao> estornadas, List<LinhaDevolucao> devolucoes, List<LinhaPagamento> linhasPagamentos) {

        static ApuracaoResponse de(Apuracao a) {
            return new ApuracaoResponse(a.organizacao(), EditoraResponse.de(a.editora()), a.mes(), a.saldoInicial(),
                    a.transferenciaAnterior(), a.obrigacoesVendas(), a.obrigacoesBaixas(), a.estornos(), a.pagamentos(),
                    a.saldoFinal(), a.estoque(), a.vendas(), a.baixas(), a.estornadas(), a.devolucoes(),
                    a.linhasPagamentos());
        }
    }

    record PedidoLivrosResponse(long id, long editoraId, String editoraNome, StatusPedidoLivros status,
            String observacao, Instant pedidoEm, String pedidoPor, Long remessaId, String remessaCodigo,
            Instant canceladoEm, String canceladoPor, String motivoCancelamento, List<ItemConferido> itens) {

        static PedidoLivrosResponse de(DetalhePedido d) {
            PedidoLivros p = d.pedido();
            return new PedidoLivrosResponse(p.getId(), p.getEditoraId(), d.editoraNome(), p.getStatus(),
                    p.getObservacao(), p.getPedidoEm(), p.getPedidoPor(), p.getRemessaId(), d.remessaCodigo(),
                    p.getCanceladoEm(), p.getCanceladoPor(), p.getMotivoCancelamento(), d.itens());
        }
    }
}
