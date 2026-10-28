package com.durvalcrm.financeiro.adapter.in.rest;

import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.ContaRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.EstornoRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.ContasRecebimentoRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.LancamentoManualRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.LiquidacaoRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.ReclassificacaoRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroRequests.TransferenciaRequest;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.CategoriaResponse;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.ContaResponse;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.ContasRecebimentoResponse;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.PaginaResponse;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.PainelTesoureiroResponse;
import com.durvalcrm.financeiro.adapter.in.rest.FinanceiroResponses.SaldosResponse;
import com.durvalcrm.financeiro.application.ComandosFinanceiros.ReclassificacaoCommand;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase.DetalheLancamento;
import com.durvalcrm.financeiro.application.ContasFinanceirasUseCase;
import com.durvalcrm.financeiro.application.ContasRecebimentoUseCase;
import com.durvalcrm.financeiro.application.FiltroLancamentos;
import com.durvalcrm.financeiro.application.OperacoesFinanceirasUseCase;
import com.durvalcrm.financeiro.application.OperacoesFinanceirasUseCase.ResultadoEstorno;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
import com.durvalcrm.financeiro.application.SaldosUseCase;
import com.durvalcrm.financeiro.domain.AnexoLancamento;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
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
 * API do módulo Financeiro (Jornada D). {@code @PreAuthorize} responde só "pode acessar o
 * endpoint?"; saldo, data de corte e período fechado são regras dos casos de uso.
 */
@RestController
@RequestMapping("/api/financeiro")
class FinanceiroController {

    private static final String ADMINISTRADOR = "hasRole('ADMINISTRADOR')";
    private static final String TESOUREIRO = "hasRole('TESOUREIRO')";
    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";

    private final ContasFinanceirasUseCase contas;
    private final SaldosUseCase saldos;
    private final OperacoesFinanceirasUseCase operacoes;
    private final ConsultarLancamentosUseCase consulta;
    private final ContasRecebimentoUseCase recebimento;
    private final PainelTesoureiroUseCase painel;

    FinanceiroController(ContasFinanceirasUseCase contas, SaldosUseCase saldos, OperacoesFinanceirasUseCase operacoes,
            ConsultarLancamentosUseCase consulta, ContasRecebimentoUseCase recebimento, PainelTesoureiroUseCase painel) {
        this.contas = contas;
        this.saldos = saldos;
        this.operacoes = operacoes;
        this.consulta = consulta;
        this.recebimento = recebimento;
        this.painel = painel;
    }

    /** US-FINANCIAL-001. */
    @GetMapping("/contas")
    @PreAuthorize(TESOURARIA)
    List<ContaResponse> contas() {
        return contas.listar().stream().map(ContaResponse::de).toList();
    }

    @GetMapping("/contas/{id}")
    @PreAuthorize(TESOURARIA)
    ContaResponse conta(@PathVariable long id) {
        return ContaResponse.de(contas.obter(id));
    }

    @PostMapping("/contas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    ContaResponse cadastrar(@RequestBody ContaRequest dados) {
        return ContaResponse.de(contas.cadastrar(dados.tipo(), dados.paraDados()));
    }

    @PutMapping("/contas/{id}")
    @PreAuthorize(TESOURARIA)
    ContaResponse alterar(@PathVariable long id, @RequestBody ContaRequest dados) {
        return ContaResponse.de(contas.alterar(id, dados.paraDados()));
    }

    @PostMapping("/contas/{id}/inativacao")
    @PreAuthorize(ADMINISTRADOR)
    ContaResponse inativar(@PathVariable long id) {
        return ContaResponse.de(contas.inativar(id));
    }

    @PostMapping("/contas/{id}/reativacao")
    @PreAuthorize(ADMINISTRADOR)
    ContaResponse reativar(@PathVariable long id) {
        return ContaResponse.de(contas.reativar(id));
    }

    @DeleteMapping("/contas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(ADMINISTRADOR)
    void excluir(@PathVariable long id) {
        contas.excluir(id);
    }

    /** Conta que recebe o dinheiro, o PIX e o cartão das vendas e contribuições. */
    @GetMapping("/contas-recebimento")
    @PreAuthorize(TESOURARIA)
    ContasRecebimentoResponse contasRecebimento() {
        return ContasRecebimentoResponse.de(recebimento.destinos());
    }

    @PutMapping("/contas-recebimento")
    @PreAuthorize(ADMINISTRADOR)
    ContasRecebimentoResponse definirContasRecebimento(@RequestBody ContasRecebimentoRequest dados) {
        return ContasRecebimentoResponse.de(recebimento.definir(dados.dinheiroContaId(), dados.pixContaId()));
    }

    /** US-FINANCIAL-002: sem data, os saldos de agora. */
    @GetMapping("/saldos")
    @PreAuthorize(TESOURARIA)
    SaldosResponse saldos(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate data) {
        return SaldosResponse.de(saldos.saldos(data));
    }

    @GetMapping("/categorias")
    @PreAuthorize(TESOURARIA)
    List<CategoriaResponse> categorias() {
        return consulta.categorias().stream().map(CategoriaResponse::de).toList();
    }

    /** US-FINANCIAL-003. */
    @PostMapping("/transferencias")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOUREIRO)
    ResultadoLancamento transferir(@RequestBody TransferenciaRequest dados) {
        return operacoes.transferir(dados.paraComando());
    }

    /** Saldo de Cartão a receber por tipo (crédito, débito, não informado), para a liquidação. */
    @GetMapping("/cartao-a-receber")
    @PreAuthorize(TESOURARIA)
    SaldosUseCase.SaldoCartaoAReceber cartaoAReceber() {
        return saldos.cartaoAReceber();
    }

    /** US-FINANCIAL-004. */
    @PostMapping("/liquidacoes-cartao")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOUREIRO)
    ResultadoLancamento liquidar(@RequestBody LiquidacaoRequest dados) {
        return operacoes.liquidarCartao(dados.paraComando());
    }

    /** US-FINANCIAL-009. */
    @PostMapping("/lancamentos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOUREIRO)
    ResultadoLancamento lancarManual(@RequestBody LancamentoManualRequest dados) {
        return operacoes.lancarManual(dados.paraComando());
    }

    /** US-FINANCIAL-005: 50 por página. */
    @GetMapping("/lancamentos")
    @PreAuthorize(TESOURARIA)
    PaginaResponse lancamentos(@RequestParam(required = false) Long contaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate,
            @RequestParam(required = false) NaturezaLancamento natureza,
            @RequestParam(required = false) String categoria, @RequestParam(required = false) String origem,
            @RequestParam(required = false) String texto, @RequestParam(required = false) BigDecimal valor,
            @RequestParam(defaultValue = "0") int pagina) {
        return PaginaResponse.de(consulta.listar(new FiltroLancamentos(contaId, de, ate, natureza, categoria, origem,
                texto, valor), pagina));
    }

    @GetMapping("/lancamentos/{id}")
    @PreAuthorize(TESOURARIA)
    DetalheLancamento lancamento(@PathVariable long id) {
        return consulta.detalhe(id);
    }

    @GetMapping("/lancamentos/{id}/anexo")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> anexo(@PathVariable long id) {
        AnexoLancamento a = consulta.anexo(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.tipo()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(a.nome()).build().toString())
                .body(a.conteudo());
    }

    /** US-FINANCIAL-010. */
    @PostMapping("/lancamentos/{id}/estorno")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    ResultadoEstorno estornar(@PathVariable long id, @RequestBody EstornoRequest dados) {
        return operacoes.estornar(id, dados.paraComando());
    }

    /** US-FINANCIAL-021. */
    @PostMapping("/lancamentos/{id}/reclassificacao")
    @PreAuthorize(TESOURARIA)
    DetalheLancamento reclassificar(@PathVariable long id, @RequestBody ReclassificacaoRequest dados) {
        operacoes.reclassificar(id, new ReclassificacaoCommand(dados.ordem(), dados.categoria(), dados.motivo()));
        return consulta.detalhe(id);
    }

    /** US-FINANCIAL-015. */
    @GetMapping("/painel-tesoureiro")
    @PreAuthorize(TESOURARIA)
    PainelTesoureiroResponse painelTesoureiro() {
        return PainelTesoureiroResponse.de(painel.painel());
    }
}
