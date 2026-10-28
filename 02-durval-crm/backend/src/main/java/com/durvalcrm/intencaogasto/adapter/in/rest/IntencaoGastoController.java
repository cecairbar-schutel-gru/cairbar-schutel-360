package com.durvalcrm.intencaogasto.adapter.in.rest;

import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoRequests.AprovacaoRequest;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoRequests.CorrecaoRequest;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoRequests.MotivoRequest;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoRequests.NovaIntencaoRequest;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoRequests.RecebimentoRequest;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoResponses.AcaoResponse;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoResponses.DetalheResponse;
import com.durvalcrm.intencaogasto.adapter.in.rest.IntencaoResponses.ResumoResponse;
import com.durvalcrm.intencaogasto.application.AprovarGastoUseCase;
import com.durvalcrm.intencaogasto.application.AprovarGastoUseCase.Contadores;
import com.durvalcrm.intencaogasto.application.ConsultarIntencaoUseCase;
import com.durvalcrm.intencaogasto.application.OpcoesIntencao;
import com.durvalcrm.intencaogasto.application.ReceberCompraUseCase;
import com.durvalcrm.intencaogasto.application.SolicitarGastoUseCase;
import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API das intenções de gasto (US-EXPENSE-001 a 009, wireframe 11). {@code @PreAuthorize} responde só
 * "pode acessar o endpoint?"; quem vê cada intenção, quem pode retirá-la e as transições de
 * situação são regras dos casos de uso.
 */
@RestController
@RequestMapping("/api/intencoes-gasto")
class IntencaoGastoController {

    private static final String TODOS = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    private static final String FORMULARIOS = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    /** Quem pede o gasto. */
    private static final String SOLICITANTE = "hasRole('VENDEDOR')";
    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";
    private static final String VENDEDOR = "hasRole('VENDEDOR')";

    private final SolicitarGastoUseCase solicitar;
    private final AprovarGastoUseCase aprovar;
    private final ReceberCompraUseCase receber;
    private final ConsultarIntencaoUseCase consultar;

    IntencaoGastoController(SolicitarGastoUseCase solicitar, AprovarGastoUseCase aprovar, ReceberCompraUseCase receber,
            ConsultarIntencaoUseCase consultar) {
        this.solicitar = solicitar;
        this.aprovar = aprovar;
        this.receber = receber;
        this.consultar = consultar;
    }

    @GetMapping("/opcoes")
    @PreAuthorize(FORMULARIOS)
    OpcoesIntencao opcoes() {
        return solicitar.opcoes();
    }

    /** US-EXPENSE-001. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(SOLICITANTE)
    AcaoResponse criar(@RequestBody NovaIntencaoRequest dados) {
        return AcaoResponse.de(solicitar.criar(dados.paraComando()));
    }

    /** US-EXPENSE-008. */
    @GetMapping("/minhas")
    @PreAuthorize(SOLICITANTE)
    List<ResumoResponse> minhas(@RequestParam(required = false) StatusIntencao status) {
        return solicitar.minhas(status).stream().map(ResumoResponse::de).toList();
    }

    @PostMapping("/minhas/visita")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(SOLICITANTE)
    void visitar() {
        solicitar.registrarVisita();
    }

    /** US-EXPENSE-002: fila de pendentes (padrão) ou de divergentes; {@code status=TODAS} lista todas. */
    @GetMapping
    @PreAuthorize(TESOURARIA)
    List<ResumoResponse> fila(@RequestParam(defaultValue = "PENDENTE") String status) {
        StatusIntencao filtro;
        try {
            filtro = "TODAS".equals(status) ? null : StatusIntencao.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw ValidacaoException.doCampo("status", "Situação desconhecida.");
        }
        return aprovar.fila(filtro).stream().map(ResumoResponse::de).toList();
    }

    @GetMapping("/contadores")
    @PreAuthorize("hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')")
    Contadores contadores() {
        return aprovar.contadores();
    }

    /** US-EXPENSE-006. */
    @GetMapping("/recebimentos")
    @PreAuthorize(VENDEDOR)
    List<ResumoResponse> aguardandoRecebimento() {
        return receber.aguardando().stream().map(ResumoResponse::de).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize(TODOS)
    DetalheResponse detalhe(@PathVariable long id) {
        return DetalheResponse.de(consultar.detalhe(id));
    }

    /** Aberto no navegador. */
    @GetMapping("/{id}/anexos/{ordem}")
    @PreAuthorize(TODOS)
    ResponseEntity<byte[]> anexo(@PathVariable long id, @PathVariable int ordem) {
        AnexoIntencao a = consultar.anexo(id, ordem);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.tipo()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(a.nome()).build().toString())
                .body(a.conteudo());
    }

    /** US-EXPENSE-009. */
    @PostMapping("/{id}/retirada")
    @PreAuthorize(SOLICITANTE)
    AcaoResponse retirar(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return AcaoResponse.de(solicitar.retirar(id, dados.motivo()));
    }

    /** US-EXPENSE-004. */
    @PostMapping("/{id}/aprovacao")
    @PreAuthorize(TESOURARIA)
    AcaoResponse aprovar(@PathVariable long id, @RequestBody AprovacaoRequest dados) {
        return AcaoResponse.de(aprovar.aprovar(id, dados.paraComando()));
    }

    /** US-EXPENSE-005. */
    @PostMapping("/{id}/rejeicao")
    @PreAuthorize(TESOURARIA)
    AcaoResponse rejeitar(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return AcaoResponse.de(aprovar.rejeitar(id, dados.motivo()));
    }

    /** US-EXPENSE-006. */
    @PostMapping("/{id}/recebimento")
    @PreAuthorize(VENDEDOR)
    AcaoResponse receber(@PathVariable long id, @RequestBody RecebimentoRequest dados) {
        return AcaoResponse.de(receber.receber(id, dados.paraComando()));
    }

    /** US-EXPENSE-007. */
    @PostMapping("/{id}/correcao")
    @PreAuthorize(TESOURARIA)
    AcaoResponse corrigir(@PathVariable long id, @RequestBody CorrecaoRequest dados) {
        return AcaoResponse.de(aprovar.corrigir(id, dados.paraComando()));
    }

    @PostMapping("/{id}/cancelamento")
    @PreAuthorize(TESOURARIA)
    AcaoResponse cancelar(@PathVariable long id, @RequestBody MotivoRequest dados) {
        return AcaoResponse.de(aprovar.cancelar(id, dados.motivo()));
    }
}
