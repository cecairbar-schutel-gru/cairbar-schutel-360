package com.durvalcrm.contapagar.adapter.in.rest;

import com.durvalcrm.contapagar.application.ContasPagarUseCase;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.Detalhe;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.PagamentoCommand;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.Parcela;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.Resultado;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.Resumo;
import com.durvalcrm.contapagar.application.ContasPagarUseCase.ResumoConta;
import com.durvalcrm.contapagar.domain.ContaPagar;
import com.durvalcrm.contapagar.domain.Recorrencia;
import java.math.BigDecimal;
import java.time.LocalDate;
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
 * API das contas a pagar. {@code @PreAuthorize} responde só "pode acessar o endpoint?": cadastro,
 * agenda e pagamentos são do Tesoureiro e do Administrador.
 */
@RestController
@RequestMapping("/api/contas-pagar")
class ContaPagarController {

    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";

    private final ContasPagarUseCase contas;

    ContaPagarController(ContasPagarUseCase contas) {
        this.contas = contas;
    }

    record ContaPagarRequest(String descricao, String favorecido, String categoria, BigDecimal valorPrevisto,
            Recorrencia recorrencia, LocalDate primeiroVencimento, LocalDate fimRecorrencia, Long contaFinanceiraId,
            String observacoes) {

        ContaPagar.Dados paraDados() {
            return new ContaPagar.Dados(descricao, favorecido, categoria, valorPrevisto, recorrencia,
                    primeiroVencimento, fimRecorrencia, contaFinanceiraId, observacoes);
        }
    }

    record PagamentoRequest(Long contaPagarId, LocalDate vencimento, LocalDate pagoEm, BigDecimal valor, Long contaId,
            String observacao, String chaveIdempotencia) {

        PagamentoCommand paraComando() {
            return new PagamentoCommand(contaPagarId, vencimento, pagoEm, valor, contaId, observacao, chaveIdempotencia);
        }
    }

    /** {@code situacao}: ATIVAS (padrão) ou TODAS. */
    @GetMapping
    @PreAuthorize(TESOURARIA)
    List<ResumoConta> listar(@RequestParam(required = false) String situacao) {
        return contas.listar("TODAS".equalsIgnoreCase(situacao));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    ContaPagar cadastrar(@RequestBody ContaPagarRequest dados) {
        return contas.cadastrar(dados.paraDados());
    }

    /** Vencimentos do período ({@code de} e {@code ate}: AAAA-MM-DD), com os vencidos de antes se pedido. */
    @GetMapping("/parcelas")
    @PreAuthorize(TESOURARIA)
    List<Parcela> parcelas(@RequestParam LocalDate de, @RequestParam LocalDate ate,
            @RequestParam(defaultValue = "false") boolean incluirVencidas) {
        return contas.parcelas(de, ate, incluirVencidas);
    }

    /** Vencidas e a vencer nos próximos dias, para os painéis do Tesoureiro e do Administrador. */
    @GetMapping("/resumo")
    @PreAuthorize(TESOURARIA)
    Resumo resumo() {
        return contas.resumo();
    }

    /** Idempotente pela {@code chaveIdempotencia}; responde {@code {id, lancamentoId, avisos[]}}. */
    @PostMapping("/pagamentos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    Resultado pagar(@RequestBody PagamentoRequest dados) {
        return contas.pagar(dados.paraComando());
    }

    @GetMapping("/{id}")
    @PreAuthorize(TESOURARIA)
    Detalhe detalhe(@PathVariable long id) {
        return contas.detalhe(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize(TESOURARIA)
    ContaPagar alterar(@PathVariable long id, @RequestBody ContaPagarRequest dados) {
        return contas.alterar(id, dados.paraDados());
    }

    @PostMapping("/{id}/encerramento")
    @PreAuthorize(TESOURARIA)
    ContaPagar encerrar(@PathVariable long id) {
        return contas.encerrar(id);
    }

    @PostMapping("/{id}/reativacao")
    @PreAuthorize(TESOURARIA)
    ContaPagar reativar(@PathVariable long id) {
        return contas.reativar(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize(TESOURARIA)
    void excluir(@PathVariable long id) {
        contas.excluir(id);
    }
}
