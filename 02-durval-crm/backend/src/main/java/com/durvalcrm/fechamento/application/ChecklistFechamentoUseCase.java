package com.durvalcrm.fechamento.application;

import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase;
import com.durvalcrm.conciliacao.application.ConsultarConciliacoesUseCase.ContaParaConciliar;
import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.fechamento.application.JanelaFechamentoUseCase.SituacaoJanela;
import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.Periodo;
import com.durvalcrm.fechamento.domain.PeriodoRepository;
import com.durvalcrm.fechamento.domain.RegrasPeriodo;
import com.durvalcrm.fechamento.domain.StatusPeriodo;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase.SituacaoCartao;
import com.durvalcrm.financeiro.application.PainelTesoureiroUseCase.SituacaoPeriodo;
import com.durvalcrm.financeiro.domain.Dinheiro;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checklist do fechamento (US-CLOSING-001): o que ainda impede fechar o mês. O fechamento não aprova
 * nada: cada item aponta para a tela, e o papel, que resolve a pendência. A situação é calculada a cada
 * consulta, ou seja, ao abrir a tela e depois de cada ação.
 */
public class ChecklistFechamentoUseCase {

    public static final String CONCILIACAO = "CONCILIACAO";
    public static final String INTENCOES = "INTENCOES";
    public static final String ESTOQUE = "ESTOQUE";
    public static final String EDITORAS = "EDITORAS";
    public static final String CARTAO = "CARTAO";

    private final PeriodoRepository periodos;
    private final DemonstrativoFinanceiroUseCase financeiro;
    private final ConsultarConciliacoesUseCase conciliacoes;
    private final IntencoesEmAbertoPort intencoes;
    private final SolicitacoesEstoquePendentesPort solicitacoes;
    private final SaldosEditorasUseCase editoras;
    private final JanelaFechamentoUseCase janela;
    private final Clock relogio;

    public ChecklistFechamentoUseCase(PeriodoRepository periodos, DemonstrativoFinanceiroUseCase financeiro,
            ConsultarConciliacoesUseCase conciliacoes, IntencoesEmAbertoPort intencoes,
            SolicitacoesEstoquePendentesPort solicitacoes, SaldosEditorasUseCase editoras,
            JanelaFechamentoUseCase janela, Clock relogio) {
        this.periodos = periodos;
        this.financeiro = financeiro;
        this.conciliacoes = conciliacoes;
        this.intencoes = intencoes;
        this.solicitacoes = solicitacoes;
        this.editoras = editoras;
        this.janela = janela;
        this.relogio = relogio;
    }

    /** O mês mais antigo aberto que já terminou, com o checklist, e o mês atual (em andamento, só leitura). */
    @Transactional(readOnly = true)
    public PainelFechamento painel() {
        YearMonth atual = YearMonth.now(relogio);
        Map<YearMonth, StatusPeriodo> situacoes = situacoes();
        Optional<YearMonth> primeiro = financeiro.primeiroPeriodo();
        Optional<YearMonth> aFechar = RegrasPeriodo.mesAFechar(primeiro.orElse(null), situacoes, atual);
        return new PainelFechamento(atual, primeiro.orElse(null), aFechar.orElse(null),
                aFechar.map(this::checklist).orElse(null), RegrasPeriodo.ultimoFechado(situacoes).orElse(null));
    }

    /** Resumo para o painel do Tesoureiro (US-FINANCIAL-015). */
    @Transactional(readOnly = true)
    public SituacaoPeriodo resumo() {
        PainelFechamento p = painel();
        if (p.checklist() == null) {
            return new SituacaoPeriodo(p.mesAtual(), "EM_ANDAMENTO", null, null);
        }
        Checklist c = p.checklist();
        return new SituacaoPeriodo(c.mes(), c.status().name(), c.concluidos(), c.itens().size());
    }

    @Transactional(readOnly = true)
    public Checklist checklist(YearMonth mes) {
        return checklist(mes, periodos.buscar(mes).orElse(Periodo.aberto(mes)));
    }

    /** Com o período já carregado (e travado, no fechamento). */
    @Transactional(readOnly = true)
    public Checklist checklist(YearMonth mes, Periodo periodo) {
        LocalDate fim = mes.atEndOfMonth();
        Instant limite = mes.plusMonths(1).atDay(1).atStartOfDay(relogio.getZone()).toInstant();
        List<ItemChecklist> itens = new ArrayList<>();

        List<String> bancos = new ArrayList<>();
        for (ContaParaConciliar c : conciliacoes.contas()) {
            if (c.dataCorte().isAfter(fim) || (c.conciliadaAte() != null && !c.conciliadaAte().isBefore(fim))) {
                continue;
            }
            bancos.add(c.contaNome() + (c.conciliadaAte() == null ? ": nunca conciliada"
                    : ": conciliada até " + Dinheiro.data(c.conciliadaAte())));
        }
        itens.add(new ItemChecklist(CONCILIACAO, "Conciliação bancária", bancos.isEmpty(), bancos.size(),
                "TESOUREIRO", bancos, null));

        long abertas = intencoes.emAbertoCriadasAntesDe(limite);
        itens.add(new ItemChecklist(INTENCOES, "Intenções de gasto", abertas == 0, abertas, "TESOUREIRO",
                abertas == 0 ? List.of() : List.of(abertas + (abertas == 1 ? " intenção pendente ou divergente"
                        : " intenções pendentes ou divergentes")), null));

        long pedidos = solicitacoes.pendentesFeitasAntesDe(limite);
        itens.add(new ItemChecklist(ESTOQUE, "Solicitações de estoque", pedidos == 0, pedidos, "ADMINISTRADOR",
                pedidos == 0 ? List.of() : List.of(pedidos + (pedidos == 1 ? " pedido aguardando o Administrador"
                        : " pedidos aguardando o Administrador")), null));

        List<String> semAcerto = editoras.fechamento(mes).editoras().stream()
                .filter(e -> e.transferencia() == null)
                .map(e -> e.nome() + ": " + Dinheiro.brl(e.saldoNoFimDoMes()))
                .toList();
        itens.add(new ItemChecklist(EDITORAS, "Editoras", semAcerto.isEmpty(), semAcerto.size(), "TESOUREIRO",
                semAcerto, null));

        SituacaoCartao cartao = financeiro.cartaoNoFimDo(mes);
        Autor confirmado = periodo.getCartaoConfirmado();
        itens.add(new ItemChecklist(CARTAO, "Liquidações de cartão", confirmado != null, confirmado == null ? 1 : 0,
                "TESOUREIRO", List.of(), new ItemCartao(cartao.saldoNoFimDoMes(), cartao.ultimaLiquidacao(),
                        confirmado == null ? null : confirmado.exibicao(), confirmado == null ? null : confirmado.em())));

        int concluidos = (int) itens.stream().filter(ItemChecklist::concluido).count();
        boolean terminou = mes.isBefore(YearMonth.now(relogio));
        StatusPeriodo status = periodo.getStatus();
        Autor reabertura = status == StatusPeriodo.REABERTO ? periodo.getReabertura() : null;
        SituacaoJanela j = janela.situacao();
        return new Checklist(mes, status, terminou, itens, concluidos,
                terminou && status != StatusPeriodo.FECHADO && concluidos == itens.size() && j.aberta(), j,
                reabertura == null ? null : reabertura.exibicao(), reabertura == null ? null : reabertura.em(),
                reabertura == null ? null : periodo.getJustificativa());
    }

    /** Meses do ciclo de fechamento; os anteriores ao primeiro período são histórico importado (US-ADMIN-012). */
    Map<YearMonth, StatusPeriodo> situacoes() {
        Optional<YearMonth> primeiro = financeiro.primeiroPeriodo();
        Map<YearMonth, StatusPeriodo> mapa = new HashMap<>();
        periodos.listar().stream()
                .filter(p -> primeiro.isEmpty() || !p.getMes().isBefore(primeiro.get()))
                .forEach(p -> mapa.put(p.getMes(), p.getStatus()));
        return mapa;
    }

    Optional<YearMonth> mesAFechar() {
        return RegrasPeriodo.mesAFechar(financeiro.primeiroPeriodo().orElse(null), situacoes(),
                YearMonth.now(relogio));
    }

    /**
     * @param primeiroPeriodo mês da data de corte mais antiga (nulo sem contas)
     * @param mesAFechar      o mais antigo aberto que já terminou (nulo se todos até o mês passado fecharam)
     * @param ultimoFechado   o único que o Administrador pode reabrir
     */
    public record PainelFechamento(YearMonth mesAtual, YearMonth primeiroPeriodo, YearMonth mesAFechar,
            Checklist checklist, YearMonth ultimoFechado) {
    }

    /**
     * @param terminou  o mês já acabou (o mês atual é só leitura)
     * @param podeFechar todos os itens passam, o mês terminou e hoje está na janela de fechamento
     *                   ("Fechar período", US-CLOSING-008 e 014)
     */
    public record Checklist(YearMonth mes, StatusPeriodo status, boolean terminou, List<ItemChecklist> itens,
            int concluidos, boolean podeFechar, SituacaoJanela janela, String reabertoPor, Instant reabertoEm, String justificativaReabertura) {
    }

    /**
     * @param responsavel papel que resolve a pendência (Estoque: só o Administrador)
     * @param detalhes    o que falta, em texto (contas, editoras)
     * @param cartao      só no item CARTAO
     */
    public record ItemChecklist(String codigo, String titulo, boolean concluido, long pendentes, String responsavel,
            List<String> detalhes, ItemCartao cartao) {
    }

    public record ItemCartao(BigDecimal saldoNoFimDoMes, LocalDate ultimaLiquidacao, String confirmadoPor,
            Instant confirmadoEm) {
    }
}
