package com.durvalcrm.contribuicao.adapter.in.rest;

import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoRequests.CancelamentoRequest;
import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoRequests.ContribuicaoRequest;
import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoRequests.MensagemRequest;
import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoResponses.ContribuicaoRegistradaResponse;
import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoResponses.IdResponse;
import com.durvalcrm.contribuicao.adapter.in.rest.ContribuicaoResponses.OpcoesPagamentoResponse;
import com.durvalcrm.contribuicao.application.CancelarContribuicaoUseCase;
import com.durvalcrm.contribuicao.application.ConsultarContribuicoesUseCase;
import com.durvalcrm.contribuicao.application.GerarCompetenciasMensaisUseCase;
import com.durvalcrm.contribuicao.application.HistoricoContribuicoes;
import com.durvalcrm.contribuicao.application.LayoutRecibo;
import com.durvalcrm.contribuicao.application.OpcoesPagamentoUseCase;
import com.durvalcrm.contribuicao.application.PainelOperador;
import com.durvalcrm.contribuicao.application.Recibo;
import com.durvalcrm.contribuicao.application.RegistrarContribuicaoUseCase;
import com.durvalcrm.contribuicao.application.RegistrarMensagemPreparadaUseCase;
import com.durvalcrm.contribuicao.application.SituacaoGeracao;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API do módulo Contribuições (Jornada A). {@code @PreAuthorize} responde só "pode acessar o
 * endpoint?"; conta de recebimento, competência já paga e cartão liquidado são regras dos casos de uso.
 */
@RestController
class ContribuicaoController {

    private static final String OPERADOR = "hasRole('OPERADOR')";
    /** O Vendedor recebe só doações anônimas (regra no caso de uso). */
    private static final String RECEBIMENTO = "hasAnyRole('OPERADOR', 'VENDEDOR')";
    /** O Vendedor vê só os recibos que emitiu (regra no caso de uso). */
    private static final String RECIBO = "hasAnyRole('OPERADOR', 'VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";

    private final OpcoesPagamentoUseCase opcoes;
    private final RegistrarContribuicaoUseCase registrar;
    private final CancelarContribuicaoUseCase cancelar;
    private final ConsultarContribuicoesUseCase consultar;
    private final RegistrarMensagemPreparadaUseCase mensagens;
    private final GerarCompetenciasMensaisUseCase geracao;

    ContribuicaoController(OpcoesPagamentoUseCase opcoes, RegistrarContribuicaoUseCase registrar,
            CancelarContribuicaoUseCase cancelar, ConsultarContribuicoesUseCase consultar,
            RegistrarMensagemPreparadaUseCase mensagens, GerarCompetenciasMensaisUseCase geracao) {
        this.opcoes = opcoes;
        this.registrar = registrar;
        this.cancelar = cancelar;
        this.consultar = consultar;
        this.mensagens = mensagens;
        this.geracao = geracao;
    }

    /** US-CONTRIB-004. */
    @GetMapping("/api/contribuicoes/opcoes-pagamento")
    @PreAuthorize(RECEBIMENTO)
    OpcoesPagamentoResponse opcoesPagamento() {
        return OpcoesPagamentoResponse.de(opcoes.opcoes());
    }

    /** US-CONTRIB-006/007/008. */
    @PostMapping("/api/contribuicoes")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(RECEBIMENTO)
    ContribuicaoRegistradaResponse registrar(@RequestBody ContribuicaoRequest dados) {
        return ContribuicaoRegistradaResponse.de(registrar.registrar(dados.paraComando()));
    }

    /** US-CONTRIB-009. */
    @GetMapping("/api/contribuicoes/{id}/recibo")
    @PreAuthorize(RECIBO)
    Recibo recibo(@PathVariable long id, @RequestParam(defaultValue = "false") boolean segundaVia) {
        return consultar.recibo(id, segundaVia);
    }

    @GetMapping("/api/contribuicoes/{id}/recibo.pdf")
    @PreAuthorize(RECIBO)
    ResponseEntity<byte[]> reciboPdf(@PathVariable long id, @RequestParam(defaultValue = "A4") LayoutRecibo layout,
            @RequestParam(defaultValue = "false") boolean segundaVia) {
        Recibo recibo = consultar.recibo(id, segundaVia);
        String arquivo = "recibo-" + recibo.numero() + (layout == LayoutRecibo.TERMICA ? "-80mm" : "") + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(arquivo).build().toString())
                .body(consultar.reciboPdf(id, layout, segundaVia));
    }

    @GetMapping("/api/contribuicoes/recibos/{numero}")
    @PreAuthorize(RECIBO)
    IdResponse porNumeroRecibo(@PathVariable String numero) {
        return new IdResponse(consultar.idPorNumeroRecibo(numero));
    }

    /** US-CONTRIB-010. */
    @PostMapping("/api/contribuicoes/{id}/mensagens")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(OPERADOR)
    void mensagemPreparada(@PathVariable long id, @RequestBody MensagemRequest dados) {
        mensagens.registrar(id, dados.canal());
    }

    /** US-CONTRIB-011. */
    @PostMapping("/api/contribuicoes/{id}/cancelamento")
    @PreAuthorize(TESOURARIA)
    ContribuicaoRegistradaResponse cancelar(@PathVariable long id, @RequestBody CancelamentoRequest dados) {
        return ContribuicaoRegistradaResponse.de(cancelar.cancelar(id, dados.motivo()));
    }

    /** US-CONTRIB-012. */
    @GetMapping("/api/doadores/{doadorId}/contribuicoes")
    @PreAuthorize("hasAnyRole('OPERADOR', 'ADMINISTRADOR')")
    HistoricoContribuicoes historico(@PathVariable long doadorId, @RequestParam(required = false) Integer ano) {
        return consultar.historico(doadorId, ano);
    }

    /** US-CONTRIB-021. */
    @GetMapping("/api/contribuicoes/painel-operador")
    @PreAuthorize(OPERADOR)
    PainelOperador painelOperador() {
        return consultar.painelOperador();
    }

    /** US-CONTRIB-001: aviso nos painéis do Tesoureiro e do Administrador. */
    @GetMapping("/api/contribuicoes/geracao-competencias")
    @PreAuthorize(TESOURARIA)
    SituacaoGeracao situacaoGeracao() {
        return geracao.situacao();
    }
}
