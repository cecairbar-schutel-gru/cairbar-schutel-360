package com.durvalcrm.venda.adapter.in.rest;

import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.venda.adapter.in.rest.VendaRequests.CancelamentoRequest;
import com.durvalcrm.venda.adapter.in.rest.VendaRequests.VendaRequest;
import com.durvalcrm.venda.adapter.in.rest.VendaResponses.OpcoesVendaResponse;
import com.durvalcrm.venda.adapter.in.rest.VendaResponses.ProdutoVendavelResponse;
import com.durvalcrm.venda.adapter.in.rest.VendaResponses.VendaRegistradaResponse;
import com.durvalcrm.venda.application.CancelarVendaUseCase;
import com.durvalcrm.venda.application.CatalogoVendaUseCase;
import com.durvalcrm.venda.application.ConfirmarVendaUseCase;
import com.durvalcrm.venda.application.ConsultarVendasUseCase;
import com.durvalcrm.venda.application.DetalheVenda;
import com.durvalcrm.venda.application.LayoutComprovante;
import com.durvalcrm.venda.application.OpcoesVendaUseCase;
import com.durvalcrm.venda.application.PainelVendedor;
import com.durvalcrm.venda.application.ResumoVenda;
import com.durvalcrm.venda.application.VendaParaRefazer;
import com.durvalcrm.venda.domain.StatusVenda;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
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
 * API do módulo Vendas (Jornada B). {@code @PreAuthorize} responde só "pode acessar o endpoint?";
 * dono da venda, conta de recebimento, saldo, preço vigente e cartão liquidado são regras dos casos de uso.
 */
@RestController
class VendaController {

    private static final String VENDEDOR = "hasRole('VENDEDOR')";
    /** PDV da cantina: o perfil PDV só vende produtos da cantina (regra dos casos de uso). */
    private static final String PDV = "hasAnyRole('VENDEDOR', 'PDV')";
    private static final String CONSULTA = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";
    /** Quem cancela cada venda (o PDV, só a própria última; o Tesoureiro, as do PDV) é regra do caso de uso. */
    private static final String CANCELAMENTO = "hasAnyRole('VENDEDOR', 'PDV', 'TESOUREIRO', 'ADMINISTRADOR')";

    private final OpcoesVendaUseCase opcoes;
    private final CatalogoVendaUseCase catalogo;
    private final ConfirmarVendaUseCase confirmar;
    private final CancelarVendaUseCase cancelar;
    private final ConsultarVendasUseCase consultar;

    VendaController(OpcoesVendaUseCase opcoes, CatalogoVendaUseCase catalogo, ConfirmarVendaUseCase confirmar,
            CancelarVendaUseCase cancelar, ConsultarVendasUseCase consultar) {
        this.opcoes = opcoes;
        this.catalogo = catalogo;
        this.confirmar = confirmar;
        this.cancelar = cancelar;
        this.consultar = consultar;
    }

    /** US-SALES-005 e US-FINANCIAL-022: contas de recebimento. */
    @GetMapping("/api/vendas/opcoes")
    @PreAuthorize(PDV)
    OpcoesVendaResponse opcoes() {
        return OpcoesVendaResponse.de(opcoes.opcoes());
    }

    /** US-SALES-002: busca por nome, título, autor ou ISBN; sem termo, lista os do tipo (botões da cantina). */
    @GetMapping("/api/vendas/produtos")
    @PreAuthorize(PDV)
    List<ProdutoVendavelResponse> produtos(@RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) TipoProduto tipo) {
        return catalogo.buscar(q, tipo).stream().map(ProdutoVendavelResponse::de).toList();
    }

    /** US-SALES-006 (idempotente pela {@code chaveIdempotencia}). */
    @PostMapping("/api/vendas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(PDV)
    VendaRegistradaResponse confirmar(@RequestBody VendaRequest dados) {
        return VendaRegistradaResponse.de(confirmar.confirmar(dados.paraComando()));
    }

    /** US-SALES-011. */
    @GetMapping("/api/vendas")
    @PreAuthorize(CONSULTA)
    List<ResumoVenda> listar(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) StatusVenda status, @RequestParam(required = false) Boolean pdv,
            @RequestParam(required = false) Long numero) {
        return consultar.listar(de, ate, status, pdv, numero);
    }

    /** US-SALES-022: a última venda registrada pelo próprio usuário (204 se ele ainda não vendeu). */
    @GetMapping("/api/vendas/ultima")
    @PreAuthorize(PDV)
    ResponseEntity<DetalheVenda> ultima() {
        return consultar.ultimaDoUsuario().map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    /** US-SALES-021. */
    @GetMapping("/api/vendas/painel-vendedor")
    @PreAuthorize(VENDEDOR)
    PainelVendedor painelVendedor() {
        return consultar.painelVendedor();
    }

    /** US-SALES-008 e 011. */
    @GetMapping("/api/vendas/{id}")
    @PreAuthorize(CONSULTA)
    DetalheVenda detalhe(@PathVariable long id) {
        return consultar.detalhe(id);
    }

    @GetMapping("/api/vendas/{id}/comprovante.pdf")
    @PreAuthorize(CONSULTA)
    ResponseEntity<byte[]> comprovantePdf(@PathVariable long id,
            @RequestParam(defaultValue = "A4") LayoutComprovante layout) {
        byte[] pdf = consultar.comprovantePdf(id, layout);
        String arquivo = "venda-" + consultar.detalhe(id).numero() + (layout == LayoutComprovante.TERMICA ? "-80mm" : "")
                + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(arquivo).build().toString())
                .body(pdf);
    }

    /** US-SALES-009. */
    @PostMapping("/api/vendas/{id}/cancelamento")
    @PreAuthorize(CANCELAMENTO)
    VendaRegistradaResponse cancelar(@PathVariable long id, @RequestBody CancelamentoRequest dados) {
        return VendaRegistradaResponse.de(cancelar.cancelar(id, dados.motivo()));
    }

    /** US-SALES-010. */
    @GetMapping("/api/vendas/{id}/refazer")
    @PreAuthorize(VENDEDOR)
    VendaParaRefazer paraRefazer(@PathVariable long id) {
        return consultar.paraRefazer(id);
    }
}
