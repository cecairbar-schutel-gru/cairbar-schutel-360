package com.durvalcrm.relatorio.application;

import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase.ItemConciliacao;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase.SessaoConciliacao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.EstoqueRemessa;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaDevolucao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaObrigacao;
import com.durvalcrm.editora.application.ConsultaEditorasPort.LinhaPagamento;
import com.durvalcrm.editora.application.SaldosEditorasUseCase.Apuracao;
import com.durvalcrm.fechamento.application.Demonstrativo.SaldoConta;
import com.durvalcrm.fechamento.application.Demonstrativo.SaldoEditora;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase.DemonstrativoMensal;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase.GrupoComparado;
import com.durvalcrm.fechamento.application.DemonstrativoMensalUseCase.LinhaComparada;
import com.durvalcrm.fechamento.domain.Variacao;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase.ItemLancamento;
import com.durvalcrm.financeiro.application.ConsultarLancamentosUseCase.PaginaLancamentos;
import com.durvalcrm.financeiro.domain.NaturezaLancamento;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.relatorio.application.ArvoreCategorias.GrupoCategoria;
import com.durvalcrm.relatorio.application.ArvoreCategorias.LinhaCategoria;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Coluna;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Construtor;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Filtro;
import com.durvalcrm.relatorio.application.DocumentoExportacao.Secao;
import com.durvalcrm.relatorio.application.RelatorioEditorasUseCase.AcertoEditora;
import com.durvalcrm.relatorio.application.RelatorioEditorasUseCase.RelatorioEditoras;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.BaixaPorMotivo;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.FolhaContagem;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.ItemContagem;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.LinhaEstoque;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.ProdutoNoRelatorio;
import com.durvalcrm.relatorio.application.RelatorioEstoqueUseCase.RelatorioEstoque;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase.RecebimentoMensalidades;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase.RelatorioMensalidades;
import com.durvalcrm.relatorio.application.RelatorioMensalidadesUseCase.SituacaoCompetencias;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase.MeioValor;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase.ProdutoVendido;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase.RelatorioVendas;
import com.durvalcrm.relatorio.application.RelatorioVendasUseCase.VendasDoVendedor;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.FluxoCaixa;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.GrupoSaldos;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.LinhaFluxo;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.ReceitasDespesas;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.SaldosPorConta;
import com.durvalcrm.relatorio.application.RelatoriosFinanceirosUseCase.TotaisSaldos;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Converte cada relatório, o demonstrativo consolidado (US-CLOSING-007), a apuração da editora
 * (US-PUBLISHER-007), o relatório da conciliação (US-RECONCILIATION-010) e a lista de lançamentos
 * (US-FINANCIAL-005) no documento da exportação, com os mesmos números e filtros da tela.
 */
final class DocumentosExportacao {

    static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    static final DateTimeFormatter MES = DateTimeFormatter.ofPattern("MM/yyyy");

    private static final Map<String, String> MEIOS = Map.of("DINHEIRO", "Dinheiro", "PIX", "PIX", "CARTAO", "Cartão",
            "TRANSFERENCIA", "Transferência", "CARTAO_CREDITO", "Cartão de crédito", "CARTAO_DEBITO", "Cartão de débito");
    private static final Map<String, String> ORIGENS = Map.of("CONTRIBUICAO", "Contribuição", "VENDA", "Venda",
            "INTENCAO_GASTO", "Intenção de gasto", "PAGAMENTO_EDITORA", "Pagamento a editora", "CONTA_PAGAR",
            "Conta a pagar", "MANUAL", "Manual", "TRANSFERENCIA", "Transferência", "LIQUIDACAO_CARTAO", "Liquidação de cartão");

    private DocumentosExportacao() {
    }

    // US-REPORT-001

    static DocumentoExportacao fluxoCaixa(FluxoCaixa f, String contas) {
        List<Filtro> filtros = List.of(new Filtro("Contas", contas),
                new Filtro("Agrupamento", switch (f.agrupamento()) {
                    case DIA -> "Por dia";
                    case SEMANA -> "Por semana";
                    case MES -> "Por mês";
                }));
        Construtor resumo = new Construtor("Resumo", Coluna.texto("Item"), Coluna.moeda("Valor"))
                .linha("Saldo inicial", f.saldoInicial())
                .linha("Entradas", f.totalEntradas())
                .linha("Saídas", f.totalSaidas())
                .linha("Transferências recebidas", f.transferenciasEntrada())
                .linha("Transferências enviadas", f.transferenciasSaida())
                .total("Saldo final", f.saldoFinal())
                .nota("Saldo inicial + entradas − saídas + transferências recebidas − enviadas = saldo final.");
        Construtor periodos = new Construtor("Movimento por " + switch (f.agrupamento()) {
            case DIA -> "dia";
            case SEMANA -> "semana";
            case MES -> "mês";
        }, Coluna.data("Início"), Coluna.data("Fim"), Coluna.moeda("Saldo inicial"), Coluna.moeda("Entradas"),
                Coluna.moeda("Saídas"), Coluna.moeda("Transf. recebidas"), Coluna.moeda("Transf. enviadas"),
                Coluna.moeda("Saldo final"));
        for (LinhaFluxo l : f.periodos()) {
            periodos.linha(l.inicio(), l.fim(), l.saldoInicial(), l.entradas(), l.saidas(), l.transferenciasEntrada(),
                    l.transferenciasSaida(), l.saldoFinal());
        }
        periodos.total("Total", null, f.saldoInicial(), f.totalEntradas(), f.totalSaidas(), f.transferenciasEntrada(),
                f.transferenciasSaida(), f.saldoFinal());
        return new DocumentoExportacao("Fluxo de caixa", "fluxo-de-caixa-" + f.de() + "-a-" + f.ate(),
                periodo(f.de(), f.ate()), filtros, List.of(resumo.montar(),
                        categorias("Entradas por categoria", f.entradas(), f.totalEntradas()),
                        categorias("Saídas por categoria", f.saidas(), f.totalSaidas()), periodos.montar()));
    }

    // US-REPORT-002

    /** {@code devidoEditoras}: saldo devido hoje às editoras (US-PUBLISHER-006), à parte do resultado. */
    static DocumentoExportacao receitasDespesas(ReceitasDespesas r, BigDecimal devidoEditoras) {
        Construtor resultado = new Construtor("Resultado", Coluna.texto("Item"), Coluna.moeda("Valor"))
                .linha("Receitas", r.totalReceitas())
                .linha("Despesas", r.totalDespesas())
                .total("Resultado (receitas − despesas)", r.resultado())
                .nota("Transferências entre contas próprias não são receita nem despesa.");
        Construtor editoras = new Construtor("Editoras", Coluna.texto("Item"), Coluna.moeda("Valor"))
                .linha("Devido às editoras (saldo atual)", devidoEditoras)
                .nota("Regime de caixa: o valor devido às editoras ainda não foi descontado do resultado; vira despesa "
                        + "quando for pago. É o saldo do dia da emissão, não o do período.");
        return new DocumentoExportacao("Receitas e despesas por categoria",
                "receitas-e-despesas-" + r.de() + "-a-" + r.ate(), periodo(r.de(), r.ate()), List.of(),
                List.of(categorias("Receitas por categoria", r.receitas(), r.totalReceitas()),
                        categorias("Despesas por categoria", r.despesas(), r.totalDespesas()), resultado.montar(),
                        editoras.montar()));
    }

    private static Secao categorias(String titulo, List<GrupoCategoria> grupos, BigDecimal total) {
        Construtor s = new Construtor(titulo, Coluna.texto("Categoria"), Coluna.texto("Subcategoria"),
                Coluna.moeda("Valor"), Coluna.percentual("% do total"));
        for (GrupoCategoria g : grupos) {
            s.linha(g.nome() + (g.ativa() ? "" : " (inativa)"), null, g.valor(), g.percentual());
            for (LinhaCategoria l : g.subcategorias()) {
                s.linha(g.nome(), l.nome() + (l.ativa() ? "" : " (inativa)"), l.valor(), l.percentual());
            }
        }
        return s.total("Total", null, total, grupos.isEmpty() ? null : new BigDecimal("100.0")).montar();
    }

    // US-REPORT-003

    static DocumentoExportacao saldos(SaldosPorConta s) {
        boolean naData = "DATA".equals(s.modo());
        List<Secao> secoes = new ArrayList<>();
        for (GrupoSaldos g : s.grupos()) {
            Construtor c = naData
                    ? new Construtor(rotulo(g.tipo()), Coluna.texto("Conta"), Coluna.moeda("Saldo"),
                            Coluna.data("Conciliada até"))
                    : new Construtor(rotulo(g.tipo()), Coluna.texto("Conta"), Coluna.moeda("Saldo inicial"),
                            Coluna.moeda("Entradas"), Coluna.moeda("Saídas"), Coluna.moeda("Transf. recebidas"),
                            Coluna.moeda("Transf. enviadas"), Coluna.moeda("Saldo final"), Coluna.data("Conciliada até"));
            for (var conta : g.contas()) {
                String nome = conta.nome() + (conta.ativa() ? "" : " (inativa)");
                if (naData) {
                    c.linha(nome, conta.saldoFinal(), conta.conciliadaAte());
                } else {
                    c.linha(nome, conta.saldoInicial(), conta.entradas(), conta.saidas(), conta.transferenciasEntrada(),
                            conta.transferenciasSaida(), conta.saldoFinal(), conta.conciliadaAte());
                }
            }
            totais(c, "Total " + rotulo(g.tipo()).toLowerCase(), g.totais(), naData);
            secoes.add(c.montar());
        }
        Construtor resumo = naData
                ? new Construtor("Posição", Coluna.texto("Item"), Coluna.moeda("Saldo"))
                : new Construtor("Posição", Coluna.texto("Item"), Coluna.moeda("Saldo inicial"), Coluna.moeda("Entradas"),
                        Coluna.moeda("Saídas"), Coluna.moeda("Transf. recebidas"), Coluna.moeda("Transf. enviadas"),
                        Coluna.moeda("Saldo final"));
        totaisComoLinha(resumo, "Disponível (caixas e bancos)", s.totalDisponivel(), naData);
        if (s.cartaoAReceber() != null) {
            var c = s.cartaoAReceber();
            if (naData) {
                resumo.linha("Cartão a receber (a receber)", c.saldoFinal());
            } else {
                resumo.linha("Cartão a receber (a receber)", c.saldoInicial(), c.entradas(), c.saidas(),
                        c.transferenciasEntrada(), c.transferenciasSaida(), c.saldoFinal());
            }
        }
        if (naData) {
            resumo.total("Disponível + a receber", s.totalComRecebiveis());
        } else {
            resumo.total("Disponível + a receber", null, null, null, null, null, s.totalComRecebiveis());
        }
        secoes.add(resumo.nota("Cartão a receber é valor a receber das adquirentes, não dinheiro disponível.").montar());
        return new DocumentoExportacao("Saldos por conta", naData ? "saldos-em-" + s.ate() : "saldos-" + s.de() + "-a-" + s.ate(),
                naData ? "Saldos no fim do dia " + DATA.format(s.ate()) : periodo(s.de(), s.ate()),
                List.of(new Filtro("Modo", naData ? "Saldo na data" : "Período")), secoes);
    }

    private static void totais(Construtor c, String rotulo, TotaisSaldos t, boolean naData) {
        if (naData) {
            c.total(rotulo, t.saldoFinal(), null);
        } else {
            c.total(rotulo, t.saldoInicial(), t.entradas(), t.saidas(), t.transferenciasEntrada(),
                    t.transferenciasSaida(), t.saldoFinal(), null);
        }
    }

    private static void totaisComoLinha(Construtor c, String rotulo, TotaisSaldos t, boolean naData) {
        if (naData) {
            c.linha(rotulo, t.saldoFinal());
        } else {
            c.linha(rotulo, t.saldoInicial(), t.entradas(), t.saidas(), t.transferenciasEntrada(),
                    t.transferenciasSaida(), t.saldoFinal());
        }
    }

    // US-REPORT-004

    static DocumentoExportacao mensalidades(RelatorioMensalidades m) {
        Construtor comp = new Construtor("Competências por mês", Coluna.texto("Competência"), Coluna.inteiro("Geradas"),
                Coluna.inteiro("Pagas"), Coluna.inteiro("Pendentes"), Coluna.inteiro("Canceladas"),
                Coluna.moeda("Valor gerado"), Coluna.moeda("Valor pago"), Coluna.moeda("Valor pendente"),
                Coluna.percentual("Taxa de pagamento"));
        for (SituacaoCompetencias s : m.porCompetencia()) {
            comp.linha(MES.format(s.mes()), s.geradas(), s.pagas(), s.pendentes(), s.canceladas(), s.valorGerado(),
                    s.valorPago(), s.valorPendente(), s.taxaPagamento());
        }
        SituacaoCompetencias t = m.totalCompetencias();
        comp.total("Total", t.geradas(), t.pagas(), t.pendentes(), t.canceladas(), t.valorGerado(), t.valorPago(),
                t.valorPendente(), t.taxaPagamento())
                .nota("Taxa de pagamento = pagas / (geradas − canceladas).");
        Construtor rec = new Construtor("Recebido em mensalidades", Coluna.texto("Mês do recebimento"),
                Coluna.inteiro("Atrasadas (qtd.)"), Coluna.moeda("Atrasadas"), Coluna.inteiro("Do mês (qtd.)"),
                Coluna.moeda("Do mês"), Coluna.inteiro("Antecipadas (qtd.)"), Coluna.moeda("Antecipadas"),
                Coluna.moeda("Total"));
        for (RecebimentoMensalidades r : m.recebimentosPorMes()) {
            recebimento(rec, MES.format(r.mes()), r, false);
        }
        recebimento(rec, "Total", m.recebimentos(), true);
        rec.nota("Pela data do recebimento (regime de caixa); cancelamentos descontados na data do estorno.");
        Construtor doadores = new Construtor("Doadores com 3 ou mais competências pendentes", Coluna.texto("Doador"),
                Coluna.inteiro("Pendentes"), Coluna.moeda("Valor pendente"), Coluna.data("Último pagamento"));
        m.doadoresComPendencias().forEach(d -> doadores.linha(d.nome(), d.pendentes(), d.valorPendente(), d.ultimoPagamento()));
        return new DocumentoExportacao("Mensalidades", "mensalidades-" + m.de() + "-a-" + m.ate(),
                "Recebimentos de " + DATA.format(m.de()) + " a " + DATA.format(m.ate()),
                List.of(new Filtro("Competências", MES.format(m.competenciaDe()) + " a " + MES.format(m.competenciaAte())),
                        new Filtro("Período de recebimento", periodo(m.de(), m.ate()))),
                List.of(comp.montar(), rec.montar(), doadores.montar()));
    }

    private static void recebimento(Construtor c, String rotulo, RecebimentoMensalidades r, boolean total) {
        Object[] celulas = {rotulo, r.atrasadas().quantidade(), r.atrasadas().valor(), r.mesCorrente().quantidade(),
            r.mesCorrente().valor(), r.antecipadas().quantidade(), r.antecipadas().valor(), r.total().valor()};
        if (total) {
            c.total(celulas);
        } else {
            c.linha(celulas);
        }
    }

    // US-REPORT-006

    static DocumentoExportacao vendas(RelatorioVendas v) {
        Construtor resumo = new Construtor("Totais", Coluna.texto("Item"), Coluna.inteiro("Quantidade"),
                Coluna.moeda("Valor"))
                .linha("Vendas no período", v.vendas(), v.receitaBruta())
                .linha("Canceladas no período", v.canceladas(), v.valorCancelado())
                .linha("Livros", null, v.livros())
                .linha("Cantina", null, v.cantina())
                .total("Receita líquida", null, v.receitaLiquida())
                .nota("Cancelamentos descontados na data em que foram feitos; livros, cantina, meios, produtos e vendedores já líquidos.");
        Construtor meios = new Construtor("Por forma de pagamento", Coluna.texto("Forma"), Coluna.moeda("Valor"));
        for (MeioValor m : v.porMeio()) {
            meios.linha("CARTAO".equals(m.meio()) ? "Cartão (tipo não informado)" : MEIOS.getOrDefault(m.meio(), m.meio()),
                    m.valor());
        }
        meios.total("Total", v.porMeio().stream().map(MeioValor::valor).reduce(BigDecimal.ZERO, BigDecimal::add));
        Construtor produtos = new Construtor("Por produto (maior receita primeiro)", Coluna.texto("Produto"),
                Coluna.texto("Tipo"), Coluna.inteiro("Quantidade"), Coluna.moeda("Receita"));
        for (ProdutoVendido p : v.porProduto()) {
            produtos.linha(p.nome(), "LIVRO".equals(p.tipo()) ? "Livro" : "Cantina", p.quantidade(), p.valor());
        }
        produtos.total("Total", null, v.porProduto().stream().mapToLong(ProdutoVendido::quantidade).sum(),
                v.porProduto().stream().map(ProdutoVendido::valor).reduce(BigDecimal.ZERO, BigDecimal::add));
        Construtor vendedores = new Construtor("Por vendedor", Coluna.texto("Vendedor"), Coluna.inteiro("Vendas"),
                Coluna.moeda("Bruto"), Coluna.inteiro("Canceladas"), Coluna.moeda("Cancelado"), Coluna.moeda("Líquido"));
        for (VendasDoVendedor c : v.porVendedor()) {
            vendedores.linha(c.nome(), c.vendas(), c.bruto(), c.canceladas(), c.cancelado(), c.liquido());
        }
        vendedores.total("Total", v.vendas(), v.receitaBruta(), v.canceladas(), v.valorCancelado(), v.receitaLiquida());
        return new DocumentoExportacao("Vendas", "vendas-" + v.de() + "-a-" + v.ate(), periodo(v.de(), v.ate()),
                List.of(), List.of(resumo.montar(), meios.montar(), produtos.montar(), vendedores.montar()));
    }

    // US-REPORT-007

    static DocumentoExportacao estoque(RelatorioEstoque e, List<Filtro> filtros) {
        Construtor s = new Construtor("Saldos e movimentos por produto", Coluna.texto("Produto"), Coluna.texto("Origem"),
                Coluna.inteiro("Inicial"), Coluna.inteiro("Compra"), Coluna.inteiro("Doação"), Coluna.inteiro("Remessa"),
                Coluna.inteiro("Venda"), Coluna.inteiro("Devolução"), Coluna.inteiro("Baixa"), Coluna.inteiro("Ajuste"),
                Coluna.inteiro("Final"));
        for (ProdutoNoRelatorio p : e.produtos()) {
            for (LinhaEstoque l : p.origens()) {
                estoqueLinha(s, p.nome(), origem(l), l, false);
            }
            if (p.origens().size() > 1) {
                estoqueLinha(s, p.nome(), "Total do produto", p.total(), false);
            }
        }
        estoqueLinha(s, "Total", null, e.total(), true);
        s.nota("Final = inicial + compra + doação + remessa − venda − devolução − baixa + ajuste. Cancelamentos e estornos "
                + "reduzem a coluna do movimento original.");
        Construtor baixas = new Construtor("Baixas por motivo", Coluna.texto("Motivo"), Coluna.inteiro("Quantidade"));
        for (BaixaPorMotivo b : e.baixasPorMotivo()) {
            baixas.linha(switch (b.motivo()) {
                case "VENCIMENTO" -> "Vencimento";
                case "DANO" -> "Dano";
                default -> "Extravio";
            }, b.quantidade());
        }
        baixas.total("Total", e.baixasPorMotivo().stream().mapToInt(BaixaPorMotivo::quantidade).sum());
        return new DocumentoExportacao("Estoque", "estoque-" + e.de() + "-a-" + e.ate(), periodo(e.de(), e.ate()), filtros,
                List.of(s.montar(), baixas.montar()));
    }

    private static void estoqueLinha(Construtor c, String produto, String origem, LinhaEstoque l, boolean total) {
        Object[] celulas = {produto, origem, l.inicial(), l.compra(), l.doacao(), l.remessa(), l.venda(), l.devolucao(),
            l.baixa(), l.ajuste(), l.fim()};
        if (total) {
            c.total(celulas);
        } else {
            c.linha(celulas);
        }
    }

    private static String origem(LinhaEstoque l) {
        if (!"CONSIGNADO".equals(l.origem())) {
            return "Próprio";
        }
        return "Consignado " + (l.remessaCodigo() == null ? "" : l.remessaCodigo())
                + (l.editoraNome() == null ? "" : " (" + l.editoraNome() + ")");
    }

    static DocumentoExportacao contagem(FolhaContagem f, List<Filtro> filtros) {
        Construtor s = new Construtor("Folha de contagem", Coluna.texto("Produto"), Coluna.texto("Tipo"),
                Coluna.texto("Categoria / editora"), Coluna.inteiro("Próprio"), Coluna.inteiro("Consignado"),
                Coluna.inteiro("No sistema"), Coluna.texto("Contado"));
        for (ItemContagem i : f.itens()) {
            s.linha(i.nome(), "LIVRO".equals(i.tipo()) ? "Livro" : "Cantina",
                    "LIVRO".equals(i.tipo()) ? i.editoraNome() : i.categoria(), i.proprio(), i.consignado(), i.quantidade(),
                    "");
        }
        s.total("Total", null, null, f.itens().stream().mapToInt(ItemContagem::proprio).sum(),
                f.itens().stream().mapToInt(ItemContagem::consignado).sum(),
                f.itens().stream().mapToInt(ItemContagem::quantidade).sum(), null);
        s.nota("Preencha a coluna \"Contado\" no inventário físico; diferenças se corrigem pelo ajuste após contagem.");
        return new DocumentoExportacao("Folha de contagem de estoque", "contagem-estoque-" + f.data(),
                "Quantidades do sistema em " + DATA.format(f.data()), filtros, List.of(s.montar()));
    }

    // US-REPORT-009

    static DocumentoExportacao editoras(RelatorioEditoras r) {
        Construtor s = new Construtor("Acertos por editora", Coluna.texto("Editora"), Coluna.moeda("Saldo inicial"),
                Coluna.moeda("Obrigações (vendas)"), Coluna.moeda("Obrigações (dano/extravio)"), Coluna.moeda("Estornos"),
                Coluna.moeda("Pagamentos"), Coluna.moeda("Saldo final"), Coluna.moeda("Transferido ao mês seguinte"));
        for (AcertoEditora a : r.editoras()) {
            s.linha(a.nome(), a.saldoInicial(), a.obrigacoesVendas(), a.obrigacoesBaixas(), a.estornos(), a.pagamentos(),
                    a.saldoFinal(), a.transferido());
        }
        AcertoEditora t = r.total();
        s.total("Total", t.saldoInicial(), t.obrigacoesVendas(), t.obrigacoesBaixas(), t.estornos(), t.pagamentos(),
                t.saldoFinal(), t.transferido())
                .nota("Saldo final = inicial + obrigações − estornos − pagamentos. A transferência do saldo é a decisão "
                        + "registrada no fechamento e não altera o valor devido.");
        return new DocumentoExportacao("Acertos com editoras", "acertos-editoras-" + r.de() + "-a-" + r.ate(),
                periodo(r.de(), r.ate()), List.of(), List.of(s.montar()));
    }

    // US-CLOSING-007

    static DocumentoExportacao demonstrativo(DemonstrativoMensal d) {
        String situacao = "FECHADO".equals(d.situacao())
                ? "Fechado (versão " + d.versao() + (d.versaoVigente() ? "" : ", substituída") + ")"
                : "Preliminar";
        Construtor resultado = comparacao("Resultado financeiro", "Item", d.mesAnterior())
                .linha("Receitas", d.totalReceitas().atual(), d.totalReceitas().anterior(), d.totalReceitas().diferenca(),
                        d.totalReceitas().percentual())
                .linha("Despesas", d.totalDespesas().atual(), d.totalDespesas().anterior(), d.totalDespesas().diferenca(),
                        d.totalDespesas().percentual());
        linhaComparada(resultado, "Resultado (receitas − despesas)", d.resultado(), true);
        resultado.nota("Transferências entre contas próprias e obrigações com editoras não entram no resultado.");
        Construtor contas = new Construtor("Saldos por conta", Coluna.texto("Conta"), Coluna.moeda("Saldo inicial"),
                Coluna.moeda("Entradas"), Coluna.moeda("Saídas"), Coluna.moeda("Transf. recebidas"),
                Coluna.moeda("Transf. enviadas"), Coluna.moeda("Saldo final"));
        BigDecimal[] soma = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
            BigDecimal.ZERO};
        for (SaldoConta c : d.contas()) {
            contas.linha(c.nome(), c.saldoInicial(), c.entradas(), c.saidas(), c.transferenciasEntrada(),
                    c.transferenciasSaida(), c.saldoFinal());
            BigDecimal[] v = {c.saldoInicial(), c.entradas(), c.saidas(), c.transferenciasEntrada(),
                c.transferenciasSaida(), c.saldoFinal()};
            for (int i = 0; i < v.length; i++) {
                soma[i] = soma[i].add(v[i]);
            }
        }
        contas.total("Total", soma[0], soma[1], soma[2], soma[3], soma[4], soma[5]);
        Construtor editoras = new Construtor("Obrigações com editoras no fim do mês", Coluna.texto("Editora"),
                Coluna.texto("Situação"), Coluna.moeda("Saldo devido"));
        for (SaldoEditora e : d.editoras()) {
            editoras.linha(e.nome(), e.transferido() ? "Transferido ao mês seguinte" : "Em aberto", e.saldo());
        }
        editoras.total("Total", null, d.totalEditoras()).nota("Mostradas à parte: não fazem parte do resultado.");
        var m = d.mensalidades();
        Construtor mensalidades = new Construtor("Mensalidades", Coluna.texto("Competências do mês"),
                Coluna.inteiro("Quantidade"), Coluna.moeda("Valor"))
                .linha("Geradas", m.geradas(), m.valorGerado())
                .linha("Pagas", m.pagas(), m.valorPago())
                .linha("Pendentes", m.pendentes(), m.valorPendente())
                .total("Recebido no mês (de qualquer competência)", null, d.recebidoMensalidades());
        return new DocumentoExportacao("Prestação de contas — demonstrativo mensal", "demonstrativo-" + d.mes(),
                "Mês " + MES.format(d.mes()), List.of(new Filtro("Situação", situacao),
                        new Filtro("Comparação", MES.format(d.mesAnterior()) + (d.anteriorFechado() ? " (fechado)" : " (preliminar)"))),
                List.of(comparadas("Receitas por categoria", d.receitas(), d.totalReceitas(), d.mesAnterior()),
                        comparadas("Despesas por categoria", d.despesas(), d.totalDespesas(), d.mesAnterior()),
                        resultado.montar(), contas.montar(), editoras.montar(), mensalidades.montar()));
    }

    private static Construtor comparacao(String titulo, String primeira, YearMonth anterior) {
        return new Construtor(titulo, Coluna.texto(primeira), Coluna.moeda("Mês"), Coluna.moeda(MES.format(anterior)),
                Coluna.moeda("Diferença"), Coluna.percentual("Variação"));
    }

    private static Secao comparadas(String titulo, List<GrupoComparado> grupos, Variacao total, YearMonth anterior) {
        Construtor s = comparacao(titulo, "Categoria", anterior);
        for (GrupoComparado g : grupos) {
            linhaComparada(s, g.nome(), g.valores(), false);
            for (LinhaComparada l : g.subcategorias()) {
                linhaComparada(s, "   " + l.nome(), l.valores(), false);
            }
        }
        linhaComparada(s, "Total", total, true);
        return s.nota("Variações acima de 20% e de R$ 100,00 merecem atenção.").montar();
    }

    private static void linhaComparada(Construtor s, String rotulo, Variacao v, boolean total) {
        Object[] celulas = {rotulo, v.atual(), v.anterior(), v.diferenca(), v.percentual()};
        if (total) {
            s.total(celulas);
        } else {
            s.linha(celulas);
        }
    }

    // US-PUBLISHER-007

    static DocumentoExportacao apuracao(Apuracao a) {
        Construtor fin = new Construtor("Seção financeira", Coluna.texto("Item"), Coluna.moeda("Valor"))
                .linha("Saldo inicial", a.saldoInicial())
                .linha("Obrigações por vendas", a.obrigacoesVendas())
                .linha("Obrigações por dano/extravio", a.obrigacoesBaixas())
                .linha("Estornos", a.estornos())
                .linha("Pagamentos", a.pagamentos())
                .total("Saldo final", a.saldoFinal());
        if (a.transferenciaAnterior() != null) {
            fin.nota("Saldo de " + MES.format(a.transferenciaAnterior().mes()) + " transferido formalmente a este mês.");
        }
        Construtor est = new Construtor("Estoque por remessa e título", Coluna.texto("Remessa"), Coluna.texto("Título"),
                Coluna.inteiro("Inicial"), Coluna.inteiro("Recebida"), Coluna.inteiro("Vendida"),
                Coluna.inteiro("Devolvida"), Coluna.inteiro("Baixada"), Coluna.inteiro("Outros"), Coluna.inteiro("Final"));
        for (EstoqueRemessa e : a.estoque()) {
            est.linha(e.remessaCodigo(), e.titulo(), e.inicial(), e.recebida(), e.vendida(), e.devolvida(), e.baixada(),
                    e.outros(), e.fim());
        }
        List<Secao> secoes = new ArrayList<>(List.of(fin.montar(), est.montar(),
                obrigacoes("Vendas", a.vendas()), obrigacoes("Baixas por dano ou extravio", a.baixas()),
                obrigacoes("Estornos", a.estornadas())));
        Construtor dev = new Construtor("Devoluções", Coluna.data("Data"), Coluna.texto("Remessa"), Coluna.texto("Título"),
                Coluna.inteiro("Quantidade"));
        for (LinhaDevolucao d : a.devolucoes()) {
            dev.linha(d.data(), d.remessaCodigo(), d.titulo(), d.quantidade());
        }
        secoes.add(dev.montar());
        Construtor pag = new Construtor("Pagamentos", Coluna.data("Data"), Coluna.texto("Conta"), Coluna.texto("Meio"),
                Coluna.moeda("Valor"), Coluna.moeda("Crédito aplicado"), Coluna.data("Estornado em"));
        for (LinhaPagamento p : a.linhasPagamentos()) {
            pag.linha(p.pagoEm(), p.contaNome(), MEIOS.getOrDefault(p.meio().name(), p.meio().name()), p.valor(),
                    p.creditoAplicado(), p.estornadoEm());
        }
        secoes.add(pag.montar());
        return new DocumentoExportacao("Apuração mensal — " + a.editora().nome(),
                "apuracao-editora-" + a.editora().id() + "-" + a.mes(), "Mês " + MES.format(a.mes()),
                List.of(new Filtro("Editora", a.editora().nome())), secoes);
    }

    private static Secao obrigacoes(String titulo, List<LinhaObrigacao> lista) {
        Construtor s = new Construtor(titulo, Coluna.data("Data"), Coluna.texto("Remessa"), Coluna.texto("Título"),
                Coluna.inteiro("Qtd."), Coluna.moeda("Preço"), Coluna.percentual("Repasse"), Coluna.moeda("Valor"));
        for (LinhaObrigacao o : lista) {
            s.linha(o.data(), o.remessaCodigo(), o.titulo(), o.quantidade(), o.precoUnitario(), o.repassePercentual(),
                    o.valor());
        }
        return s.total("Total", null, null, lista.stream().mapToInt(LinhaObrigacao::quantidade).sum(), null, null,
                lista.stream().map(LinhaObrigacao::valor).reduce(BigDecimal.ZERO, BigDecimal::add)).montar();
    }

    // US-RECONCILIATION-010

    static DocumentoExportacao conciliacao(SessaoConciliacao s) {
        Construtor resumo = new Construtor("Resumo", Coluna.texto("Item"), Coluna.moeda("Valor"))
                .linha("Saldo conciliado anterior", s.saldoAbertura())
                .linha("Total marcado", s.totalMarcado())
                .linha("Saldo pelo sistema", s.saldoConciliado())
                .linha("Saldo do extrato", s.saldoExtrato())
                .total("Diferença", s.diferenca());
        return new DocumentoExportacao("Conciliação bancária — " + s.contaNome(), "conciliacao-" + s.id(),
                "Até " + DATA.format(s.dataFim()),
                List.of(new Filtro("Conta", s.contaNome()), new Filtro("Situação",
                        s.concluidaEm() == null ? "Em andamento" : "Concluída por " + s.concluidaPor())),
                List.of(resumo.montar(), itensConciliacao(s.concluidaEm() == null ? "Lançamentos" : "Conciliados",
                        s.lancamentos()), itensConciliacao("Pendentes (diferenças de prazo)", s.pendentes())));
    }

    private static Secao itensConciliacao(String titulo, List<ItemConciliacao> itens) {
        Construtor s = new Construtor(titulo, Coluna.data("Data"), Coluna.texto("Descrição"), Coluna.texto("Tipo"),
                Coluna.moeda("Valor"), Coluna.texto("Observação"));
        for (ItemConciliacao i : itens) {
            s.linha(i.data(), i.descricao(), natureza(i.natureza()), i.valor(),
                    i.adicionado() ? "Adicionado na conciliação" : i.estornaLancamentoId() != null ? "Estorno" : "");
        }
        return s.total("Total", null, null, itens.stream().map(ItemConciliacao::valor).reduce(BigDecimal.ZERO,
                BigDecimal::add), null).montar();
    }

    // US-FINANCIAL-005

    static DocumentoExportacao lancamentos(PaginaLancamentos p, List<Filtro> filtros, LocalDate de, LocalDate ate,
            int limite) {
        boolean comConta = p.conta() != null;
        List<Coluna> colunas = new ArrayList<>(List.of(Coluna.data("Data"), Coluna.texto("Descrição"),
                Coluna.texto("Tipo"), Coluna.texto("Origem"), Coluna.texto("Categorias"), Coluna.texto("Contas"),
                Coluna.moeda("Valor"), Coluna.texto("Registrado por")));
        if (comConta) {
            colunas.add(Coluna.moeda("Saldo após"));
        }
        Construtor s = new Construtor("Lançamentos", colunas.toArray(Coluna[]::new));
        BigDecimal total = BigDecimal.ZERO;
        for (ItemLancamento i : p.itens()) {
            List<Object> c = new ArrayList<>(List.of(i.data(), i.descricao(), natureza(i.natureza()),
                    ORIGENS.getOrDefault(i.origemTipo(), i.origemTipo()), String.join("; ", i.categorias()),
                    String.join("; ", i.contas()), i.valor(), i.usuario() == null ? "" : i.usuario()));
            if (comConta) {
                c.add(i.saldoApos());
            }
            s.linha(c.toArray());
            total = total.add(i.valor());
        }
        if (comConta) {
            s.total("Saldo final", null, null, null, null, null, total, null, p.saldoFinal());
            s.nota("Saldo anterior ao período: " + brl(p.saldoAnterior()) + ".");
        } else {
            s.total("Total", null, null, null, null, null, total, null);
        }
        if (p.temMais()) {
            s.nota("Exportação limitada aos primeiros " + limite + " lançamentos: refine os filtros para ver o restante.");
        }
        return new DocumentoExportacao("Lançamentos", "lancamentos" + (de == null ? "" : "-" + de) + (ate == null ? "" : "-a-" + ate),
                de == null && ate == null ? "Todo o período" : periodo(de, ate), filtros, List.of(s.montar()));
    }

    // Auxiliares

    static String periodo(LocalDate de, LocalDate ate) {
        if (de == null) {
            return "Até " + DATA.format(ate);
        }
        if (ate == null) {
            return "Desde " + DATA.format(de);
        }
        return de.equals(ate) ? DATA.format(de) : DATA.format(de) + " a " + DATA.format(ate);
    }

    static String rotulo(TipoConta tipo) {
        return switch (tipo) {
            case CAIXA -> "Caixas";
            case BANCO -> "Bancos";
            case CARTAO_A_RECEBER -> "Cartão a receber";
        };
    }

    static String natureza(NaturezaLancamento n) {
        if (n == null) {
            return "";
        }
        return switch (n) {
            case RECEITA -> "Receita";
            case DESPESA -> "Despesa";
            case TRANSFERENCIA -> "Transferência";
            case LIQUIDACAO -> "Liquidação";
            case ESTORNO -> "Estorno";
        };
    }

    static String origemLancamento(String origem) {
        return ORIGENS.getOrDefault(origem, origem);
    }

    private static String brl(BigDecimal v) {
        return v == null ? "—" : "R$ " + String.format(java.util.Locale.of("pt", "BR"), "%,.2f", v);
    }
}
