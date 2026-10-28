package com.durvalcrm.editora.adapter.in.rest;

import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.DevolucaoRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.EditoraRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.MotivoRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.PagamentoRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.PedidoLivrosRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.RemessaRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraRequests.TransferenciaRequest;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.AcaoResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.ApuracaoResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.DetalheEditoraResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.DevolucaoResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.EditoraResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.PedidoLivrosResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.ReciboResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.RemessaResponse;
import com.durvalcrm.editora.adapter.in.rest.EditoraResponses.SaldoDetalhadoResponse;
import com.durvalcrm.editora.application.CadastroEditorasUseCase;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoEditora;
import com.durvalcrm.editora.application.ConsultaEditorasPort.ResumoRemessa;
import com.durvalcrm.editora.application.PagarEditoraUseCase;
import com.durvalcrm.editora.application.PagarEditoraUseCase.Previa;
import com.durvalcrm.editora.application.PagarEditoraUseCase.Resultado;
import com.durvalcrm.editora.application.PedidosLivrosUseCase;
import com.durvalcrm.editora.application.PedidosLivrosUseCase.ResumoPedido;
import com.durvalcrm.editora.application.RemessasUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase.FechamentoEditoras;
import com.durvalcrm.editora.application.SaldosEditorasUseCase.QuadroSaldos;
import com.durvalcrm.editora.domain.PedidoLivros;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.editora.domain.TituloConsignado;
import com.durvalcrm.editora.domain.TransferenciaSaldo;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API do módulo Editoras (US-PUBLISHER-001 a 010). {@code @PreAuthorize} responde só "pode acessar o
 * endpoint?": cadastro, remessas e devoluções são do Vendedor; pedidos de livros, saldos e apuração, da
 * Tesouraria; pagamentos e transferências de saldo, do Tesoureiro. O Administrador faz tudo, menos pagar.
 */
@RestController
@RequestMapping("/api/editoras")
class EditoraController {

    private static final String CONSULTA = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    private static final String CADASTRO = "hasAnyRole('VENDEDOR', 'ADMINISTRADOR')";
    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";
    private static final String TESOUREIRO = "hasRole('TESOUREIRO')";

    private final CadastroEditorasUseCase cadastro;
    private final RemessasUseCase remessas;
    private final PedidosLivrosUseCase pedidos;
    private final PagarEditoraUseCase pagamentos;
    private final SaldosEditorasUseCase saldos;

    EditoraController(CadastroEditorasUseCase cadastro, RemessasUseCase remessas, PedidosLivrosUseCase pedidos,
            PagarEditoraUseCase pagamentos, SaldosEditorasUseCase saldos) {
        this.cadastro = cadastro;
        this.remessas = remessas;
        this.pedidos = pedidos;
        this.pagamentos = pagamentos;
        this.saldos = saldos;
    }

    /** US-PUBLISHER-001. {@code situacao}: ATIVAS (padrão), INATIVAS ou TODAS. */
    @GetMapping
    @PreAuthorize(CONSULTA)
    List<ResumoEditora> listar(@RequestParam(required = false) String situacao) {
        return cadastro.listar(situacao);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(CADASTRO)
    EditoraResponse cadastrar(@RequestBody EditoraRequest dados) {
        return EditoraResponse.de(cadastro.cadastrar(dados.paraDados()));
    }

    @GetMapping("/{id}")
    @PreAuthorize(CONSULTA)
    DetalheEditoraResponse detalhe(@PathVariable long id) {
        return DetalheEditoraResponse.de(cadastro.detalhe(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize(CADASTRO)
    EditoraResponse alterar(@PathVariable long id, @RequestBody EditoraRequest dados) {
        return EditoraResponse.de(cadastro.alterar(id, dados.paraDados()));
    }

    @PostMapping("/{id}/inativacao")
    @PreAuthorize(CADASTRO)
    EditoraResponse inativar(@PathVariable long id) {
        return EditoraResponse.de(cadastro.inativar(id));
    }

    @PostMapping("/{id}/reativacao")
    @PreAuthorize(CADASTRO)
    EditoraResponse reativar(@PathVariable long id) {
        return EditoraResponse.de(cadastro.reativar(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(CADASTRO)
    void excluir(@PathVariable long id) {
        cadastro.excluir(id);
    }

    /** Títulos da editora para a nova remessa e o pedido de livros, com o percentual padrão. */
    @GetMapping("/{id}/titulos")
    @PreAuthorize(CONSULTA)
    List<TituloConsignado> titulos(@PathVariable long id) {
        return cadastro.titulos(id);
    }

    /** US-PUBLISHER-003. {@code situacao}: ABERTA, ENCERRADA ou CANCELADA. */
    @GetMapping("/remessas")
    @PreAuthorize(CONSULTA)
    List<ResumoRemessa> remessas(@RequestParam(required = false) Long editoraId,
            @RequestParam(required = false) String situacao) {
        return remessas.listar(editoraId, situacao);
    }

    @PostMapping("/remessas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(CADASTRO)
    AcaoResponse registrarRemessa(@RequestBody RemessaRequest dados) {
        Remessa r = remessas.registrar(dados.paraComando());
        return new AcaoResponse(r.getId(), r.getCodigo());
    }

    @GetMapping("/remessas/{id}")
    @PreAuthorize(CONSULTA)
    RemessaResponse remessa(@PathVariable long id) {
        return RemessaResponse.de(remessas.detalhe(id));
    }

    @PostMapping("/remessas/{id}/cancelamento")
    @PreAuthorize(CADASTRO)
    AcaoResponse cancelarRemessa(@PathVariable long id, @RequestBody MotivoRequest dados) {
        Remessa r = remessas.cancelar(id, dados.motivo());
        return new AcaoResponse(r.getId(), r.getCodigo());
    }

    /**
     * Pedidos de livros. {@code situacao}: ABERTO, RECEBIDO ou CANCELADO. O Vendedor consulta para
     * registrar a remessa contra o pedido; só a Tesouraria pede e cancela.
     */
    @GetMapping("/pedidos")
    @PreAuthorize(CONSULTA)
    List<ResumoPedido> pedidos(@RequestParam(required = false) Long editoraId,
            @RequestParam(required = false) String situacao) {
        return pedidos.listar(editoraId, situacao);
    }

    @PostMapping("/pedidos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    PedidoLivrosResponse pedir(@RequestBody PedidoLivrosRequest dados) {
        PedidoLivros p = pedidos.criar(dados.paraComando());
        return PedidoLivrosResponse.de(pedidos.detalhe(p.getId()));
    }

    @GetMapping("/pedidos/{id}")
    @PreAuthorize(CONSULTA)
    PedidoLivrosResponse pedido(@PathVariable long id) {
        return PedidoLivrosResponse.de(pedidos.detalhe(id));
    }

    @PostMapping("/pedidos/{id}/cancelamento")
    @PreAuthorize(TESOURARIA)
    PedidoLivrosResponse cancelarPedido(@PathVariable long id, @RequestBody MotivoRequest dados) {
        pedidos.cancelar(id, dados.motivo());
        return PedidoLivrosResponse.de(pedidos.detalhe(id));
    }

    /** US-PUBLISHER-005. */
    @PostMapping("/remessas/{id}/devolucoes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(CADASTRO)
    DevolucaoResponse devolver(@PathVariable long id, @RequestBody DevolucaoRequest dados) {
        return DevolucaoResponse.de(remessas.devolver(id, dados.paraComando()));
    }

    /** Comprovante de devolução para a editora assinar. */
    @GetMapping("/devolucoes/{id}")
    @PreAuthorize(CONSULTA)
    DevolucaoResponse devolucao(@PathVariable long id) {
        return DevolucaoResponse.de(remessas.devolucao(id));
    }

    /** US-PUBLISHER-006. */
    @GetMapping("/saldos")
    @PreAuthorize(TESOURARIA)
    QuadroSaldos saldos() {
        return saldos.saldos();
    }

    @GetMapping("/{id}/saldo")
    @PreAuthorize(TESOURARIA)
    SaldoDetalhadoResponse saldo(@PathVariable long id) {
        return SaldoDetalhadoResponse.de(saldos.detalhe(id));
    }

    /** US-PUBLISHER-007. {@code mes}: AAAA-MM. */
    @GetMapping("/{id}/apuracao")
    @PreAuthorize(TESOURARIA)
    ApuracaoResponse apuracao(@PathVariable long id, @RequestParam String mes) {
        return ApuracaoResponse.de(saldos.apuracao(id, EditoraRequests.mes(mes)));
    }

    /** US-PUBLISHER-008: alocação que o pagamento faria, antes de confirmar. */
    @GetMapping("/pagamentos/previa")
    @PreAuthorize(TESOUREIRO)
    Previa previa(@RequestParam long editoraId, @RequestParam BigDecimal valor) {
        return pagamentos.previa(editoraId, valor);
    }

    /** Idempotente pela {@code chaveIdempotencia}; responde {@code {id, lancamentoId, avisos[]}}. */
    @PostMapping("/pagamentos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOUREIRO)
    Resultado pagar(@RequestBody PagamentoRequest dados) {
        return pagamentos.pagar(dados.paraComando());
    }

    @GetMapping("/pagamentos/{id}")
    @PreAuthorize(TESOURARIA)
    ReciboResponse recibo(@PathVariable long id) {
        return ReciboResponse.de(pagamentos.recibo(id));
    }

    /** US-PUBLISHER-010: editoras com saldo no fim do mês e o que já foi transferido. */
    @GetMapping("/fechamento")
    @PreAuthorize(TESOURARIA)
    FechamentoEditoras fechamento(@RequestParam String mes) {
        return saldos.fechamento(EditoraRequests.mes(mes));
    }

    @PostMapping("/transferencias-saldo")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOUREIRO)
    TransferenciaSaldo transferir(@RequestBody TransferenciaRequest dados) {
        return saldos.transferir(dados.editoraId(), EditoraRequests.mes(dados.mes()), dados.nota());
    }
}
