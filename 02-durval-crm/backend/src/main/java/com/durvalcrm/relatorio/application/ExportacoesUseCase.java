package com.durvalcrm.relatorio.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase;
import com.durvalcrm.financeiro.application.FiltroLancamentos;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Filtro;
import com.durvalcrm.relatorio.application.ExportadorPort.Emissao;
import com.durvalcrm.relatorio.application.FormatoExportacao.Arquivo;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.FluxoCaixa;
import com.durvalcrm.relatorio.domain.Agrupamento;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exportação para Excel e PDF (US-REPORT-021) de todo relatório do módulo, do demonstrativo
 * consolidado, da apuração da editora, do relatório da conciliação e da lista de lançamentos. O
 * arquivo traz exatamente os filtros da tela, também impressos no cabeçalho, e cada exportação fica
 * na auditoria (quem, qual relatório, quais filtros).
 */
public class ExportacoesUseCase {

    /** Limite da lista de lançamentos exportada de uma vez (dez mil linhas em menos de 10 s). */
    public static final int LIMITE_LANCAMENTOS = 10_000;

    private final RelatoriosFinanceirosUseCase financeiros;
    private final RelatorioMensalidadesUseCase mensalidades;
    private final RelatorioVendasUseCase vendas;
    private final RelatorioEstoqueUseCase estoque;
    private final RelatorioEditorasUseCase editoras;
    private final DemonstrativoMensalUseCase demonstrativos;
    private final SaldosEditorasUseCase saldosEditoras;
    private final ConsultarConciliacoesUseCase conciliacoes;
    private final ConsultarLancamentosUseCase lancamentos;
    private final ContaFinanceiraRepository contas;
    private final CategoriaRepository categorias;
    private final EditoraRepository cadastroEditoras;
    private final ExportadorPort exportador;
    private final DadosOrganizacaoPort organizacao;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public ExportacoesUseCase(RelatoriosFinanceirosUseCase financeiros, RelatorioMensalidadesUseCase mensalidades,
            RelatorioVendasUseCase vendas, RelatorioEstoqueUseCase estoque, RelatorioEditorasUseCase editoras,
            DemonstrativoMensalUseCase demonstrativos, SaldosEditorasUseCase saldosEditoras,
            ConsultarConciliacoesUseCase conciliacoes, ConsultarLancamentosUseCase lancamentos,
            ContaFinanceiraRepository contas, CategoriaRepository categorias, EditoraRepository cadastroEditoras,
            ExportadorPort exportador, DadosOrganizacaoPort organizacao, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.financeiros = financeiros;
        this.mensalidades = mensalidades;
        this.vendas = vendas;
        this.estoque = estoque;
        this.editoras = editoras;
        this.demonstrativos = demonstrativos;
        this.saldosEditoras = saldosEditoras;
        this.conciliacoes = conciliacoes;
        this.lancamentos = lancamentos;
        this.contas = contas;
        this.categorias = categorias;
        this.cadastroEditoras = cadastroEditoras;
        this.exportador = exportador;
        this.organizacao = organizacao;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Arquivo fluxoCaixa(FormatoExportacao formato, PeriodoRelatorio periodo, Agrupamento agrupamento, Long contaId,
            TipoConta tipoConta) {
        FluxoCaixa f = financeiros.fluxoCaixa(periodo, agrupamento, contaId, tipoConta);
        String descricao = contaId != null ? f.contas().get(0).nome()
                : tipoConta != null ? DocumentosExportacao.rotulo(tipoConta) : "Todas as contas";
        return gerar("FLUXO_CAIXA", DocumentosExportacao.fluxoCaixa(f, descricao), formato);
    }

    @Transactional
    public Arquivo receitasDespesas(FormatoExportacao formato, PeriodoRelatorio periodo) {
        return gerar("RECEITAS_DESPESAS", DocumentosExportacao.receitasDespesas(financeiros.porCategoria(periodo),
                saldosEditoras.saldos().total()), formato);
    }

    /** {@code data} preenchida: modo "saldo na data"; senão, o período. */
    @Transactional
    public Arquivo saldos(FormatoExportacao formato, PeriodoRelatorio periodo, LocalDate data) {
        var s = data != null ? financeiros.saldosNaData(data) : financeiros.saldos(periodo);
        return gerar("SALDOS_CONTAS", DocumentosExportacao.saldos(s), formato);
    }

    @Transactional
    public Arquivo mensalidades(FormatoExportacao formato, YearMonth competenciaDe, YearMonth competenciaAte,
            PeriodoRelatorio recebimento) {
        return gerar("MENSALIDADES", DocumentosExportacao.mensalidades(
                mensalidades.gerar(competenciaDe, competenciaAte, recebimento)), formato);
    }

    @Transactional
    public Arquivo vendas(FormatoExportacao formato, PeriodoRelatorio periodo) {
        return gerar("VENDAS", DocumentosExportacao.vendas(vendas.gerar(periodo)), formato);
    }

    @Transactional
    public Arquivo estoque(FormatoExportacao formato, PeriodoRelatorio periodo, String tipo, String categoria,
            Long editoraId, boolean somenteComMovimento) {
        List<Filtro> filtros = filtrosEstoque(tipo, categoria, editoraId);
        filtros.add(new Filtro("Somente com movimento", somenteComMovimento ? "Sim" : "Não"));
        return gerar("ESTOQUE", DocumentosExportacao.estoque(
                estoque.gerar(periodo, tipo, categoria, editoraId, somenteComMovimento), filtros), formato);
    }

    @Transactional
    public Arquivo contagem(FormatoExportacao formato, String tipo, String categoria, Long editoraId) {
        return gerar("CONTAGEM_ESTOQUE", DocumentosExportacao.contagem(estoque.contagem(tipo, categoria, editoraId),
                filtrosEstoque(tipo, categoria, editoraId)), formato);
    }

    @Transactional
    public Arquivo editoras(FormatoExportacao formato, PeriodoRelatorio periodo) {
        return gerar("ACERTOS_EDITORAS", DocumentosExportacao.editoras(editoras.gerar(periodo)), formato);
    }

    @Transactional
    public Arquivo demonstrativo(FormatoExportacao formato, YearMonth mes, Integer versao) {
        return gerar("DEMONSTRATIVO", DocumentosExportacao.demonstrativo(demonstrativos.consultar(mes, versao)), formato);
    }

    @Transactional
    public Arquivo apuracao(FormatoExportacao formato, long editoraId, YearMonth mes) {
        return gerar("APURACAO_EDITORA", DocumentosExportacao.apuracao(saldosEditoras.apuracao(editoraId, mes)), formato);
    }

    @Transactional
    public Arquivo conciliacao(FormatoExportacao formato, long id) {
        return gerar("CONCILIACAO", DocumentosExportacao.conciliacao(conciliacoes.sessao(id)), formato);
    }

    @Transactional
    public Arquivo lancamentos(FormatoExportacao formato, FiltroLancamentos filtro) {
        List<Filtro> filtros = new ArrayList<>();
        if (filtro.contaId() != null) {
            filtros.add(new Filtro("Conta", contas.buscarPorId(filtro.contaId()).map(ContaFinanceira::nome)
                    .orElse("Conta " + filtro.contaId())));
        }
        if (filtro.natureza() != null) {
            filtros.add(new Filtro("Tipo", DocumentosExportacao.natureza(filtro.natureza())));
        }
        if (filtro.categoria() != null && !filtro.categoria().isBlank()) {
            filtros.add(new Filtro("Categoria", categorias.buscar(filtro.categoria()).map(Categoria::nomeCompleto)
                    .orElse(filtro.categoria())));
        }
        if (filtro.origem() != null && !filtro.origem().isBlank()) {
            filtros.add(new Filtro("Origem", DocumentosExportacao.origemLancamento(filtro.origem())));
        }
        if (filtro.texto() != null && !filtro.texto().isBlank()) {
            filtros.add(new Filtro("Texto", filtro.texto().trim()));
        }
        if (filtro.valor() != null) {
            filtros.add(new Filtro("Valor", filtro.valor().abs().setScale(2).toPlainString().replace('.', ',')));
        }
        return gerar("LANCAMENTOS", DocumentosExportacao.lancamentos(lancamentos.listarAte(filtro, LIMITE_LANCAMENTOS),
                filtros, filtro.de(), filtro.ate(), LIMITE_LANCAMENTOS), formato);
    }

    private List<Filtro> filtrosEstoque(String tipo, String categoria, Long editoraId) {
        List<Filtro> filtros = new ArrayList<>();
        filtros.add(new Filtro("Tipo", tipo == null || tipo.isBlank() ? "Todos"
                : "LIVRO".equals(tipo) ? "Livros" : "Cantina"));
        if (categoria != null && !categoria.isBlank()) {
            filtros.add(new Filtro("Categoria", categoria.trim()));
        }
        if (editoraId != null) {
            filtros.add(new Filtro("Editora", cadastroEditoras.obter(editoraId).map(Editora::nome)
                    .orElse("Editora " + editoraId)));
        }
        return filtros;
    }

    private Arquivo gerar(String relatorio, DocumentoExportacao documento, FormatoExportacao formato) {
        DadosOrganizacao dados = organizacao.atuais();
        Emissao emissao = new Emissao(dados.nome(), relogio.instant(), relogio.getZone(),
                usuario.getNome() == null ? usuario.getUsername() : usuario.getNome(), dados.logo());
        byte[] conteudo = formato == FormatoExportacao.PDF ? exportador.pdf(documento, emissao)
                : exportador.planilha(documento, emissao);
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("formato", formato.name());
        detalhes.put("titulo", documento.titulo());
        detalhes.put("periodo", documento.periodo());
        detalhes.put("filtros", documento.filtros().stream()
                .collect(Collectors.toMap(Filtro::rotulo, Filtro::valor, (a, b) -> a, LinkedHashMap::new)));
        detalhes.put("linhas", documento.linhas());
        auditoria.registrar("RELATORIO_EXPORTADO", "Relatorio", relatorio, detalhes);
        return new Arquivo(documento.arquivo() + "." + formato.extensao(), formato.tipoConteudo(), conteudo);
    }

}
