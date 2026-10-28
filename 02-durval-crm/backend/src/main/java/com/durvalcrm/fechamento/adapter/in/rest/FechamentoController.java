package com.durvalcrm.fechamento.adapter.in.rest;

import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase;
import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase.Checklist;
import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase.PainelFechamento;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase.DemonstrativoMensal;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase.HistoricoPeriodo;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase.PeriodoReaberto;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase.ResumoPeriodo;
import com.durvalcrm.fechamento.application.JanelaFechamentoUseCase;
import com.durvalcrm.fechamento.application.JanelaFechamentoUseCase.SituacaoJanela;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * API do fechamento mensal (US-CLOSING-001, 007, 008, 009, 013 e 014). O Tesoureiro ou o Administrador fecha,
 * dentro da janela de fechamento que eles mesmos configuram; só o Administrador reabre. Ordem dos meses, checklist e justificativa ficam no domínio e nos casos de uso.
 * O mês vai no caminho como AAAA-MM.
 */
@RestController
@RequestMapping("/api/fechamentos")
class FechamentoController {

    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";

    private final ChecklistFechamentoUseCase checklist;
    private final FechamentoMensalUseCase fechamento;
    private final DemonstrativoMensalUseCase demonstrativos;
    private final JanelaFechamentoUseCase janela;

    FechamentoController(ChecklistFechamentoUseCase checklist, FechamentoMensalUseCase fechamento,
            DemonstrativoMensalUseCase demonstrativos, JanelaFechamentoUseCase janela) {
        this.checklist = checklist;
        this.fechamento = fechamento;
        this.demonstrativos = demonstrativos;
        this.janela = janela;
    }

    /** US-CLOSING-014: dias de cada mês em que o fechamento pode ser feito. */
    @GetMapping("/janela")
    @PreAuthorize(TESOURARIA)
    SituacaoJanela janela() {
        return janela.situacao();
    }

    /** 422 com janela de mais de 7 dias, fim antes do início ou dia fora de 1 a 28. */
    @PutMapping("/janela")
    @PreAuthorize(TESOURARIA)
    SituacaoJanela alterarJanela(@RequestBody JanelaRequest dados) {
        return janela.alterar(dados.diaInicio(), dados.diaFim());
    }

    /** US-CLOSING-001: o mês a fechar com o checklist e o mês atual em andamento. */
    @GetMapping("/painel")
    @PreAuthorize(TESOURARIA)
    PainelFechamento painel() {
        return checklist.painel();
    }

    @GetMapping
    @PreAuthorize(TESOURARIA)
    List<ResumoPeriodo> periodos() {
        return fechamento.periodos();
    }

    /** Aviso dos meses reabertos, para todos os perfis (US-CLOSING-009). */
    @GetMapping("/reabertos")
    @PreAuthorize("isAuthenticated()")
    List<PeriodoReaberto> reabertos() {
        return fechamento.reabertos();
    }

    @GetMapping("/{mes}/checklist")
    @PreAuthorize(TESOURARIA)
    Checklist checklist(@PathVariable String mes) {
        return checklist.checklist(mes(mes));
    }

    /** Item 5 do checklist. */
    @PostMapping("/{mes}/cartao")
    @PreAuthorize(TESOURARIA)
    Checklist confirmarCartao(@PathVariable String mes) {
        YearMonth m = mes(mes);
        fechamento.confirmarCartao(m);
        return checklist.checklist(m);
    }

    /**
     * US-CLOSING-008: 409 CHECKLIST_PENDENTE, PERIODO_FORA_DE_ORDEM, PERIODO_EM_ANDAMENTO ou
     * FORA_DA_JANELA_FECHAMENTO (US-CLOSING-014).
     */
    @PostMapping("/{mes}/fechamento")
    @PreAuthorize(TESOURARIA)
    HistoricoPeriodo fechar(@PathVariable String mes, @RequestBody(required = false) FechamentoRequest dados) {
        YearMonth m = mes(mes);
        fechamento.fechar(m, dados == null ? null : dados.nota());
        return fechamento.historico(m);
    }

    /** US-CLOSING-009: 409 REABERTURA_FORA_DE_ORDEM; 422 com justificativa curta. */
    @PostMapping("/{mes}/reabertura")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    HistoricoPeriodo reabrir(@PathVariable String mes, @RequestBody ReaberturaRequest dados) {
        YearMonth m = mes(mes);
        fechamento.reabrir(m, dados.justificativa());
        return fechamento.historico(m);
    }

    @GetMapping("/{mes}/historico")
    @PreAuthorize(TESOURARIA)
    HistoricoPeriodo historico(@PathVariable String mes) {
        return fechamento.historico(mes(mes));
    }

    /** US-CLOSING-007 e 013; {@code versao} escolhe uma versão gravada (inclusive as substituídas). */
    @GetMapping("/{mes}/demonstrativo")
    @PreAuthorize(TESOURARIA)
    DemonstrativoMensal demonstrativo(@PathVariable String mes, @RequestParam(required = false) Integer versao) {
        return demonstrativos.consultar(mes(mes), versao);
    }

    private static YearMonth mes(String valor) {
        try {
            return YearMonth.parse(valor);
        } catch (DateTimeParseException e) {
            throw ValidacaoException.doCampo("mes", "Informe o mês no formato AAAA-MM.");
        }
    }

    record FechamentoRequest(String nota) {
    }

    record ReaberturaRequest(String justificativa) {
    }

    record JanelaRequest(Integer diaInicio, Integer diaFim) {
    }
}
