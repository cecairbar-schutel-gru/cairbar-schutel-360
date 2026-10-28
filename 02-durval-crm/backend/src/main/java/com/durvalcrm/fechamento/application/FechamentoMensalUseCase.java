package com.durvalcrm.fechamento.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase.Checklist;
import com.durvalcrm.fechamento.application.ChecklistFechamentoUseCase.ItemChecklist;
import com.durvalcrm.fechamento.application.SnapshotsPort.VersaoSnapshot;
import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.EventoPeriodo;
import com.durvalcrm.fechamento.domain.EventoPeriodo.TipoEvento;
import com.durvalcrm.fechamento.domain.Periodo;
import com.durvalcrm.fechamento.domain.PeriodoRepository;
import com.durvalcrm.fechamento.domain.RegrasPeriodo;
import com.durvalcrm.fechamento.domain.StatusPeriodo;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fechar (US-CLOSING-008) e reabrir (009) o mês, confirmar as liquidações de cartão (item 5 do
 * checklist) e o histórico de cada período. Cada ação trava o registro do mês e vai para a auditoria.
 */
public class FechamentoMensalUseCase {

    static final String ENTIDADE = "Periodo";
    /** Meses mostrados na lista de períodos. */
    static final int MESES_NA_LISTA = 24;

    private final PeriodoRepository periodos;
    private final ChecklistFechamentoUseCase checklist;
    private final DemonstrativoMensalUseCase demonstrativos;
    private final SnapshotsPort snapshots;
    private final JanelaFechamentoUseCase janela;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public FechamentoMensalUseCase(PeriodoRepository periodos, ChecklistFechamentoUseCase checklist,
            DemonstrativoMensalUseCase demonstrativos, SnapshotsPort snapshots, JanelaFechamentoUseCase janela,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.periodos = periodos;
        this.checklist = checklist;
        this.demonstrativos = demonstrativos;
        this.snapshots = snapshots;
        this.janela = janela;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /**
     * Exige o mês da vez, o checklist todo concluído (conferido de novo com o mês travado) e hoje dentro da
     * janela de fechamento (US-CLOSING-014). Grava os saldos e o demonstrativo como nova versão.
     */
    @Transactional
    public Periodo fechar(YearMonth mes, String nota) {
        exigirMes(mes);
        Periodo p = periodos.travar(mes);
        RegrasPeriodo.exigirVezDeFechar(mes, checklist.mesAFechar(), YearMonth.now(relogio));
        Checklist c = checklist.checklist(mes, p);
        List<String> pendentes = c.itens().stream().filter(i -> !i.concluido()).map(ItemChecklist::titulo).toList();
        if (!pendentes.isEmpty()) {
            throw new RegraDeNegocioException("CHECKLIST_PENDENTE",
                    "Ainda há itens pendentes no checklist: " + String.join(", ", pendentes) + ".");
        }
        janela.exigirAberta();
        Autor autor = autor();
        p.fechar(autor, nota);
        periodos.salvar(p);
        int versao = snapshots.gravar(mes, demonstrativos.montar(mes), autor);
        periodos.registrar(new EventoPeriodo(mes, TipoEvento.FECHAMENTO, autor, p.getNota(), versao));
        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("versao", versao);
        detalhes.put("nota", p.getNota());
        auditoria.registrar("PERIODO_FECHADO", ENTIDADE, mes.toString(), detalhes);
        return p;
    }

    /**
     * Meses do histórico importado (US-ADMIN-012) entram fechados, sem checklist (são anteriores ao
     * primeiro período), com a versão do demonstrativo e o evento "Importação".
     */
    @Transactional
    public void fecharImportados(Collection<YearMonth> meses, long importacaoId) {
        Autor autor = autor();
        String texto = "Histórico importado (importação nº " + importacaoId + ").";
        for (YearMonth mes : new TreeSet<>(meses)) {
            Periodo p = periodos.travar(mes);
            if (p.getStatus() != StatusPeriodo.ABERTO) {
                throw new RegraDeNegocioException("PERIODO_FECHADO",
                        "O mês de " + RegrasPeriodo.MES.format(mes) + " já está fechado.");
            }
            p.fechar(autor, texto);
            periodos.salvar(p);
            int versao = snapshots.gravar(mes, demonstrativos.montar(mes), autor);
            periodos.registrar(new EventoPeriodo(mes, TipoEvento.IMPORTACAO, autor, texto, versao));
        }
    }

    /** Os meses continuam fechados só pela importação (nenhuma reabertura ou outro evento depois dela)? */
    @Transactional(readOnly = true)
    public boolean importadosIntocados(Collection<YearMonth> meses) {
        return meses.stream().allMatch(mes -> periodos.buscar(mes)
                .filter(p -> p.getStatus() == StatusPeriodo.FECHADO)
                .map(p -> periodos.eventos(mes).stream().allMatch(e -> e.evento() == TipoEvento.IMPORTACAO))
                .orElse(false));
    }

    /** Ao desfazer a importação, os meses fechados por ela voltam a não existir (abertos). */
    @Transactional
    public void desfazerImportados(Collection<YearMonth> meses) {
        meses.forEach(periodos::travar);
        if (!importadosIntocados(meses)) {
            throw new RegraDeNegocioException("IMPORTACAO_COM_MOVIMENTOS",
                    "Algum mês fechado pela importação foi reaberto depois dela.");
        }
        meses.forEach(periodos::excluir);
    }

    /** Só o mês fechado mais recente; volta a aceitar lançamentos e precisa passar pelo checklist de novo. */
    @Transactional
    public Periodo reabrir(YearMonth mes, String justificativa) {
        exigirMes(mes);
        Periodo p = periodos.travar(mes);
        RegrasPeriodo.exigirUltimoFechado(mes, RegrasPeriodo.ultimoFechado(checklist.situacoes()));
        Autor autor = autor();
        p.reabrir(autor, justificativa);
        periodos.salvar(p);
        periodos.registrar(new EventoPeriodo(mes, TipoEvento.REABERTURA, autor, p.getJustificativa(), null));
        auditoria.registrar("PERIODO_REABERTO", ENTIDADE, mes.toString(),
                Map.of("justificativa", p.getJustificativa()));
        return p;
    }

    /** Item 5 do checklist, só no mês da vez. */
    @Transactional
    public Periodo confirmarCartao(YearMonth mes) {
        exigirMes(mes);
        Periodo p = periodos.travar(mes);
        Optional<YearMonth> aFechar = checklist.mesAFechar();
        if (aFechar.isEmpty() || !aFechar.get().equals(mes)) {
            throw new RegraDeNegocioException("PERIODO_FORA_DE_ORDEM", aFechar
                    .map(m -> "A confirmação vale para o mês a fechar (" + RegrasPeriodo.MES.format(m) + ").")
                    .orElse("Não há mês a fechar."));
        }
        Autor autor = autor();
        p.confirmarCartao(autor);
        periodos.salvar(p);
        periodos.registrar(new EventoPeriodo(mes, TipoEvento.CARTAO_CONFIRMADO, autor, null, null));
        auditoria.registrar("PERIODO_CARTAO_CONFIRMADO", ENTIDADE, mes.toString(), Map.of());
        return p;
    }

    /** Os últimos meses até o atual, do mais recente ao mais antigo, a partir do primeiro período. */
    @Transactional(readOnly = true)
    public List<ResumoPeriodo> periodos() {
        ChecklistFechamentoUseCase.PainelFechamento painel = checklist.painel();
        YearMonth atual = painel.mesAtual();
        if (painel.primeiroPeriodo() == null) {
            return List.of();
        }
        Map<YearMonth, Periodo> registrados = periodos.listar().stream()
                .collect(Collectors.toMap(Periodo::getMes, p -> p));
        YearMonth inicio = painel.primeiroPeriodo().isAfter(atual.minusMonths(MESES_NA_LISTA - 1))
                ? painel.primeiroPeriodo() : atual.minusMonths(MESES_NA_LISTA - 1);
        List<ResumoPeriodo> lista = new ArrayList<>();
        for (YearMonth m = atual; !m.isBefore(inicio); m = m.minusMonths(1)) {
            Periodo p = registrados.getOrDefault(m, Periodo.aberto(m));
            Autor f = p.getFechamento();
            Autor r = p.getReabertura();
            lista.add(new ResumoPeriodo(m, m.equals(atual) ? "EM_ANDAMENTO" : p.getStatus().name(),
                    f == null ? null : f.exibicao(), f == null ? null : f.em(), p.getNota(),
                    r == null ? null : r.exibicao(), r == null ? null : r.em(), p.getJustificativa(),
                    snapshots.versoes(m).size(), m.equals(painel.mesAFechar()), m.equals(painel.ultimoFechado())));
        }
        return lista;
    }

    @Transactional(readOnly = true)
    public HistoricoPeriodo historico(YearMonth mes) {
        exigirMes(mes);
        Periodo p = periodos.buscar(mes).orElse(Periodo.aberto(mes));
        return new HistoricoPeriodo(mes, p.getStatus(), periodos.eventos(mes), snapshots.versoes(mes));
    }

    /** Aviso para todos os usuários (US-CLOSING-009): meses reabertos, com quem reabriu e quando. */
    @Transactional(readOnly = true)
    public List<PeriodoReaberto> reabertos() {
        return periodos.listar().stream().filter(p -> p.getStatus() == StatusPeriodo.REABERTO)
                .map(p -> new PeriodoReaberto(p.getMes(), p.getReabertura().exibicao(), p.getReabertura().em()))
                .toList();
    }

    private Autor autor() {
        return new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant());
    }

    private static void exigirMes(YearMonth mes) {
        if (mes == null) {
            throw ValidacaoException.doCampo("mes", "Escolha o mês.");
        }
    }

    /**
     * @param situacao    EM_ANDAMENTO (mês atual), ABERTO, FECHADO ou REABERTO
     * @param versoes     quantas vezes o mês foi fechado
     * @param aFechar     é o mês da vez (US-CLOSING-001)
     * @param podeReabrir é o mês fechado mais recente (US-CLOSING-009)
     */
    public record ResumoPeriodo(YearMonth mes, String situacao, String fechadoPor, Instant fechadoEm,
            String nota, String reabertoPor, Instant reabertoEm, String justificativa, int versoes,
            boolean aFechar, boolean podeReabrir) {
    }

    public record HistoricoPeriodo(YearMonth mes, StatusPeriodo status, List<EventoPeriodo> eventos,
            List<VersaoSnapshot> versoes) {
    }

    public record PeriodoReaberto(YearMonth mes, String reabertoPor, Instant reabertoEm) {
    }
}
