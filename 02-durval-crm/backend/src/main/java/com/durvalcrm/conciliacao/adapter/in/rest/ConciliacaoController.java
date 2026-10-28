package com.durvalcrm.conciliacao.adapter.in.rest;

import com.durvalcrm.conciliacao.application.ConciliarContaUseCase;
import com.durvalcrm.conciliacao.application.ConciliarContaUseCase.ImportacaoExtrato;
import com.durvalcrm.conciliacao.application.ConciliarContaUseCase.NovoLancamentoConciliacao;
import com.durvalcrm.conciliacao.application.ConciliarContaUseCase.ParExtrato;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase.ContaParaConciliar;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase.SessaoConciliacao;
import com.durvalcrm.conciliacao.application.LancamentosBancariosPort.ResumoConciliacao;
import com.durvalcrm.financeiro.application.ResultadoLancamento;
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
 * API da conciliação bancária (US-RECONCILIATION-001 a 012). O Tesoureiro e o Administrador conciliam. As regras (uma sessão por conta, diferença zero, extrato) ficam
 * no domínio.
 */
@RestController
@RequestMapping("/api/conciliacoes")
class ConciliacaoController {

    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";

    private final ConciliarContaUseCase conciliar;
    private final ConsultarConciliacoesUseCase consulta;

    ConciliacaoController(ConciliarContaUseCase conciliar, ConsultarConciliacoesUseCase consulta) {
        this.conciliar = conciliar;
        this.consulta = consulta;
    }

    /** US-RECONCILIATION-001: contas bancárias ativas com a situação da conciliação. */
    @GetMapping("/contas")
    @PreAuthorize(TESOURARIA)
    List<ContaParaConciliar> contas() {
        return consulta.contas();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao iniciar(@RequestBody ExtratoRequest dados) {
        return consulta.sessao(conciliar.iniciar(dados.contaId(), dados.dataFim(), dados.saldoExtrato()).getId());
    }

    /** US-RECONCILIATION-010: sessões concluídas. */
    @GetMapping
    @PreAuthorize(TESOURARIA)
    List<ResumoConciliacao> historico(@RequestParam(required = false) Long contaId) {
        return consulta.historico(contaId);
    }

    /** Em andamento: lista para marcar e resumo; concluída: o relatório. */
    @GetMapping("/{id}")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao sessao(@PathVariable long id) {
        return consulta.sessao(id);
    }

    @PutMapping("/{id}/extrato")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao alterarExtrato(@PathVariable long id, @RequestBody ExtratoRequest dados) {
        conciliar.alterarExtrato(id, dados.dataFim(), dados.saldoExtrato());
        return consulta.sessao(id);
    }

    /** US-RECONCILIATION-003: cada clique é gravado na hora. */
    @PostMapping("/{id}/marcacoes")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao marcar(@PathVariable long id, @RequestBody MarcacaoRequest dados) {
        conciliar.marcar(id, dados.lancamentoIds(), !Boolean.FALSE.equals(dados.marcado()));
        return consulta.sessao(id);
    }

    /** Extrato do banco (OFX ou CSV) lido no navegador; substitui o importado antes. */
    @PutMapping("/{id}/extrato/linhas")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao importarExtrato(@PathVariable long id, @RequestBody ImportacaoExtrato dados) {
        conciliar.importarExtrato(id, dados);
        return consulta.sessao(id);
    }

    /** Pares linha do extrato → lançamento confirmados: os lançamentos ficam marcados. */
    @PostMapping("/{id}/extrato/pares")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao confirmarPares(@PathVariable long id, @RequestBody ParesRequest dados) {
        conciliar.confirmarPares(id, dados.pares());
        return consulta.sessao(id);
    }

    @DeleteMapping("/{id}/extrato/linhas/{linhaId}/par")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao desfazerPar(@PathVariable long id, @PathVariable long linhaId) {
        conciliar.desfazerPar(id, linhaId);
        return consulta.sessao(id);
    }

    /** US-RECONCILIATION-005: responde {id, avisos[]} do lançamento criado, já marcado. */
    @PostMapping("/{id}/lancamentos")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(TESOURARIA)
    ResultadoLancamento adicionar(@PathVariable long id, @RequestBody NovoLancamentoConciliacao dados) {
        return conciliar.adicionarLancamento(id, dados);
    }

    /** US-RECONCILIATION-007. */
    @PostMapping("/{id}/conclusao")
    @PreAuthorize(TESOURARIA)
    SessaoConciliacao concluir(@PathVariable long id) {
        conciliar.concluir(id);
        return consulta.sessao(id);
    }

    record ExtratoRequest(Long contaId, LocalDate dataFim, BigDecimal saldoExtrato) {
    }

    record MarcacaoRequest(List<Long> lancamentoIds, Boolean marcado) {
    }

    record ParesRequest(List<ParExtrato> pares) {
    }
}
