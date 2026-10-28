package com.durvalcrm.relatorio.adapter.in.rest;

import com.durvalcrm.financeiro.application.FiltroLancamentos;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.relatorio.application.ExportacoesUseCase;
import com.durvalcrm.relatorio.application.FormatoExportacao;
import com.durvalcrm.relatorio.application.FormatoExportacao.Arquivo;
import com.durvalcrm.relatorio.application.RelatorioEditorasUseCase;
import com.durvalcrm.relatorio.application.RelatorioEditorasUseCase.RelatorioEditoras;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.FolhaContagem;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.RelatorioEstoque;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase.RelatorioMensalidades;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase.RelatorioVendas;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.FluxoCaixa;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.ReceitasDespesas;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.SaldosPorConta;
import com.durvalcrm.relatorio.domain.Agrupamento;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Relatórios (US-REPORT-001 a 009) e a exportação para Excel e PDF (021). Tesoureiro e
 * Administrador veem todos; o Vendedor vê vendas e estoque; o Operador nenhum. Sem período, vale o
 * mês atual. As exportações recebem os mesmos filtros da tela e mais {@code formato} (PDF ou XLSX).
 */
@RestController
@RequestMapping("/api/relatorios")
class RelatorioController {

    private static final String TESOURARIA = "hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')";
    private static final String VENDAS_E_ESTOQUE = "hasAnyRole('VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')";

    private final RelatoriosFinanceirosUseCase financeiros;
    private final RelatorioMensalidadesUseCase mensalidades;
    private final RelatorioVendasUseCase vendas;
    private final RelatorioEstoqueUseCase estoque;
    private final RelatorioEditorasUseCase editoras;
    private final ExportacoesUseCase exportacoes;

    RelatorioController(RelatoriosFinanceirosUseCase financeiros, RelatorioMensalidadesUseCase mensalidades,
            RelatorioVendasUseCase vendas, RelatorioEstoqueUseCase estoque, RelatorioEditorasUseCase editoras,
            ExportacoesUseCase exportacoes) {
        this.financeiros = financeiros;
        this.mensalidades = mensalidades;
        this.vendas = vendas;
        this.estoque = estoque;
        this.editoras = editoras;
        this.exportacoes = exportacoes;
    }

    /** US-REPORT-001. */
    @GetMapping("/fluxo-caixa")
    @PreAuthorize(TESOURARIA)
    FluxoCaixa fluxoCaixa(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) Agrupamento agrupamento, @RequestParam(required = false) Long contaId,
            @RequestParam(required = false) TipoConta tipoConta) {
        return financeiros.fluxoCaixa(periodo(de, ate, financeiros.hoje()), agrupamento, contaId, tipoConta);
    }

    /** US-REPORT-002. */
    @GetMapping("/receitas-despesas")
    @PreAuthorize(TESOURARIA)
    ReceitasDespesas receitasDespesas(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return financeiros.porCategoria(periodo(de, ate, financeiros.hoje()));
    }

    /** US-REPORT-003; com {@code data}, o modo "saldo na data". */
    @GetMapping("/saldos")
    @PreAuthorize(TESOURARIA)
    SaldosPorConta saldos(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate data) {
        return data != null ? financeiros.saldosNaData(data) : financeiros.saldos(periodo(de, ate, financeiros.hoje()));
    }

    /** US-REPORT-004: meses das competências (AAAA-MM) e período dos recebimentos. */
    @GetMapping("/mensalidades")
    @PreAuthorize(TESOURARIA)
    RelatorioMensalidades mensalidades(@RequestParam(required = false) String competenciaDe,
            @RequestParam(required = false) String competenciaAte,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return mensalidades.gerar(mes("competenciaDe", competenciaDe), mes("competenciaAte", competenciaAte),
                periodo(de, ate, mensalidades.hoje()));
    }

    /** US-REPORT-006: o Vendedor vê só as vendas que fez. */
    @GetMapping("/vendas")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    RelatorioVendas vendas(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return vendas.gerar(periodo(de, ate, vendas.hoje()));
    }

    /** US-REPORT-007. */
    @GetMapping("/estoque")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    RelatorioEstoque estoque(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) String tipo, @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Long editoraId,
            @RequestParam(defaultValue = "false") boolean somenteComMovimento) {
        return estoque.gerar(periodo(de, ate, estoque.hoje()), tipo, categoria, editoraId, somenteComMovimento);
    }

    /** US-REPORT-007: folha de contagem do inventário físico. */
    @GetMapping("/estoque/contagem")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    FolhaContagem contagem(@RequestParam(required = false) String tipo, @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Long editoraId) {
        return estoque.contagem(tipo, categoria, editoraId);
    }

    /** US-REPORT-009. */
    @GetMapping("/editoras")
    @PreAuthorize(TESOURARIA)
    RelatorioEditoras editoras(@RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return editoras.gerar(periodo(de, ate, editoras.hoje()));
    }

    // US-REPORT-021

    @GetMapping("/exportacoes/fluxo-caixa")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarFluxoCaixa(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) Agrupamento agrupamento, @RequestParam(required = false) Long contaId,
            @RequestParam(required = false) TipoConta tipoConta) {
        return arquivo(exportacoes.fluxoCaixa(FormatoExportacao.de(formato), periodo(de, ate, financeiros.hoje()),
                agrupamento, contaId, tipoConta));
    }

    @GetMapping("/exportacoes/receitas-despesas")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarReceitasDespesas(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return arquivo(exportacoes.receitasDespesas(FormatoExportacao.de(formato), periodo(de, ate, financeiros.hoje())));
    }

    @GetMapping("/exportacoes/saldos")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarSaldos(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate data) {
        FormatoExportacao f = FormatoExportacao.de(formato);
        return arquivo(exportacoes.saldos(f, data == null ? periodo(de, ate, financeiros.hoje()) : null, data));
    }

    @GetMapping("/exportacoes/mensalidades")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarMensalidades(@RequestParam(required = false) String formato,
            @RequestParam(required = false) String competenciaDe, @RequestParam(required = false) String competenciaAte,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return arquivo(exportacoes.mensalidades(FormatoExportacao.de(formato), mes("competenciaDe", competenciaDe),
                mes("competenciaAte", competenciaAte), periodo(de, ate, mensalidades.hoje())));
    }

    @GetMapping("/exportacoes/vendas")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    ResponseEntity<byte[]> exportarVendas(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return arquivo(exportacoes.vendas(FormatoExportacao.de(formato), periodo(de, ate, vendas.hoje())));
    }

    @GetMapping("/exportacoes/estoque")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    ResponseEntity<byte[]> exportarEstoque(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) String tipo, @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Long editoraId,
            @RequestParam(defaultValue = "false") boolean somenteComMovimento) {
        return arquivo(exportacoes.estoque(FormatoExportacao.de(formato), periodo(de, ate, estoque.hoje()), tipo, categoria,
                editoraId, somenteComMovimento));
    }

    @GetMapping("/exportacoes/contagem-estoque")
    @PreAuthorize(VENDAS_E_ESTOQUE)
    ResponseEntity<byte[]> exportarContagem(@RequestParam(required = false) String formato,
            @RequestParam(required = false) String tipo, @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Long editoraId) {
        return arquivo(exportacoes.contagem(FormatoExportacao.de(formato), tipo, categoria, editoraId));
    }

    @GetMapping("/exportacoes/editoras")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarEditoras(@RequestParam(required = false) String formato,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate) {
        return arquivo(exportacoes.editoras(FormatoExportacao.de(formato), periodo(de, ate, editoras.hoje())));
    }

    /** Demonstrativo consolidado (US-CLOSING-007). */
    @GetMapping("/exportacoes/demonstrativo")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarDemonstrativo(@RequestParam(required = false) String formato,
            @RequestParam(required = false) String mes, @RequestParam(required = false) Integer versao) {
        return arquivo(exportacoes.demonstrativo(FormatoExportacao.de(formato), exigirMes(mes), versao));
    }

    /** Apuração mensal da editora (US-PUBLISHER-007). */
    @GetMapping("/exportacoes/apuracao-editora")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarApuracao(@RequestParam(required = false) String formato,
            @RequestParam long editoraId, @RequestParam(required = false) String mes) {
        return arquivo(exportacoes.apuracao(FormatoExportacao.de(formato), editoraId, exigirMes(mes)));
    }

    /** Relatório da conciliação (US-RECONCILIATION-010). */
    @GetMapping("/exportacoes/conciliacao")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarConciliacao(@RequestParam(required = false) String formato, @RequestParam long id) {
        return arquivo(exportacoes.conciliacao(FormatoExportacao.de(formato), id));
    }

    /** Lista de lançamentos (US-FINANCIAL-005) com os mesmos filtros da tela, até 10.000 linhas. */
    @GetMapping("/exportacoes/lancamentos")
    @PreAuthorize(TESOURARIA)
    ResponseEntity<byte[]> exportarLancamentos(@RequestParam(required = false) String formato,
            @RequestParam(required = false) Long contaId,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate de,
            @RequestParam(required = false) @DateTimeFormat(iso = ISO.DATE) LocalDate ate,
            @RequestParam(required = false) NaturezaLancamento natureza, @RequestParam(required = false) String categoria,
            @RequestParam(required = false) String origem, @RequestParam(required = false) String texto,
            @RequestParam(required = false) BigDecimal valor) {
        return arquivo(exportacoes.lancamentos(FormatoExportacao.de(formato),
                new FiltroLancamentos(contaId, de, ate, natureza, categoria, origem, texto, valor)));
    }

    private static ResponseEntity<byte[]> arquivo(Arquivo a) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.tipoConteudo()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(a.nome()).build().toString())
                .body(a.conteudo());
    }

    private static PeriodoRelatorio periodo(LocalDate de, LocalDate ate, LocalDate hoje) {
        return PeriodoRelatorio.ouMesDe(de, ate, hoje);
    }

    private static YearMonth mes(String campo, String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return YearMonth.parse(valor);
        } catch (DateTimeParseException e) {
            throw ValidacaoException.doCampo(campo, "Informe o mês no formato AAAA-MM.");
        }
    }

    private static YearMonth exigirMes(String valor) {
        YearMonth m = mes("mes", valor);
        if (m == null) {
            throw ValidacaoException.doCampo("mes", "Escolha o mês.");
        }
        return m;
    }
}
