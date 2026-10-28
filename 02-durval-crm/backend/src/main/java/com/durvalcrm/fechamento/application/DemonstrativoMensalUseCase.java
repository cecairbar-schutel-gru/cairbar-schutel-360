package com.durvalcrm.fechamento.application;

import com.durvalcrm.editora.application.SaldosEditorasUseCase;
import com.durvalcrm.fechamento.application.CompetenciasDoMesPort.ResumoCompetencias;
import com.durvalcrm.fechamento.application.Demonstrativo.Grupo;
import com.durvalcrm.fechamento.application.Demonstrativo.Linha;
import com.durvalcrm.fechamento.application.Demonstrativo.SaldoConta;
import com.durvalcrm.fechamento.application.Demonstrativo.SaldoEditora;
import com.durvalcrm.fechamento.application.SnapshotsPort.Snapshot;
import com.durvalcrm.fechamento.application.SnapshotsPort.VersaoSnapshot;
import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.Periodo;
import com.durvalcrm.fechamento.domain.PeriodoRepository;
import com.durvalcrm.fechamento.domain.Variacao;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase.CategoriaDoMes;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase.ResultadoPorCategoria;
import com.durvalcrm.financeiro.domain.CategoriaFinanceira;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Demonstrativo consolidado do mês (US-CLOSING-007) com a comparação ao mês anterior (013). Antes do
 * fechamento é preliminar, calculado na hora; fechado, é a versão gravada no fechamento. O mês anterior
 * usa a versão fechada quando existe.
 */
public class DemonstrativoMensalUseCase {

    private final PeriodoRepository periodos;
    private final SnapshotsPort snapshots;
    private final DemonstrativoFinanceiroUseCase financeiro;
    private final SaldosEditorasUseCase editoras;
    private final CompetenciasDoMesPort competencias;
    private final Clock relogio;

    public DemonstrativoMensalUseCase(PeriodoRepository periodos, SnapshotsPort snapshots,
            DemonstrativoFinanceiroUseCase financeiro, SaldosEditorasUseCase editoras,
            CompetenciasDoMesPort competencias, Clock relogio) {
        this.periodos = periodos;
        this.snapshots = snapshots;
        this.financeiro = financeiro;
        this.editoras = editoras;
        this.competencias = competencias;
        this.relogio = relogio;
    }

    /** Números do mês calculados agora (preliminar, ou o conteúdo da versão gravada ao fechar). */
    @Transactional(readOnly = true)
    public Demonstrativo montar(YearMonth mes) {
        ResultadoPorCategoria categorias = financeiro.porCategoria(mes);
        List<Grupo> receitas = grupos(categorias.receitas());
        List<Grupo> despesas = grupos(categorias.despesas());
        BigDecimal totalReceitas = somar(receitas);
        BigDecimal totalDespesas = somar(despesas);
        List<SaldoConta> contas = financeiro.movimentoPorConta(mes).stream()
                .map(c -> new SaldoConta(c.contaId(), c.nome(), c.tipo().name(), c.saldoInicial(), c.entradas(),
                        c.saidas(), c.transferenciasEntrada(), c.transferenciasSaida(), c.saldoFinal()))
                .toList();
        List<SaldoEditora> obrigacoes = editoras.fechamento(mes).editoras().stream()
                .map(e -> new SaldoEditora(e.editoraId(), e.nome(), e.saldoNoFimDoMes(), e.transferencia() != null))
                .toList();
        BigDecimal recebidoMensalidades = receitas.stream().flatMap(g -> g.subcategorias().stream())
                .filter(l -> l.codigo().equals(CategoriaFinanceira.MENSALIDADES))
                .map(Linha::valor).findFirst().orElse(BigDecimal.ZERO);
        return new Demonstrativo(mes, receitas, totalReceitas, despesas, totalDespesas,
                totalReceitas.subtract(totalDespesas), contas, obrigacoes,
                obrigacoes.stream().map(SaldoEditora::saldo).reduce(BigDecimal.ZERO, BigDecimal::add),
                competencias.resumo(mes), recebidoMensalidades);
    }

    /** {@code versao} nula: a vigente (gravada, se o mês está fechado; senão, preliminar). */
    @Transactional(readOnly = true)
    public DemonstrativoMensal consultar(YearMonth mes, Integer versao) {
        if (mes == null) {
            throw ValidacaoException.doCampo("mes", "Escolha o mês.");
        }
        if (mes.isAfter(YearMonth.now(relogio))) {
            throw ValidacaoException.doCampo("mes", "O mês não pode ser futuro.");
        }
        Periodo periodo = periodos.buscar(mes).orElse(Periodo.aberto(mes));
        List<VersaoSnapshot> versoes = snapshots.versoes(mes);
        Optional<Snapshot> gravado;
        if (versao != null) {
            gravado = Optional.of(snapshots.versao(mes, versao).orElseThrow(() -> new RecursoNaoEncontradoException(
                    "VERSAO_NAO_ENCONTRADA", "Versão do demonstrativo não encontrada.")));
        } else {
            gravado = periodo.fechado() ? snapshots.ultima(mes) : Optional.empty();
        }
        Demonstrativo atual = gravado.map(Snapshot::demonstrativo).orElseGet(() -> montar(mes));
        boolean vigente = gravado.isEmpty()
                || (periodo.fechado() && !versoes.isEmpty() && versoes.get(0).versao() == gravado.get().versao());

        YearMonth mesAnterior = mes.minusMonths(1);
        boolean anteriorFechado = periodos.buscar(mesAnterior).map(Periodo::fechado).orElse(false);
        Demonstrativo anterior = (anteriorFechado ? snapshots.ultima(mesAnterior).map(Snapshot::demonstrativo)
                : Optional.<Demonstrativo>empty()).orElseGet(() -> montar(mesAnterior));

        return new DemonstrativoMensal(mes, gravado.isPresent() ? "FECHADO" : "PRELIMINAR",
                gravado.map(Snapshot::versao).orElse(null), vigente, gravado.map(Snapshot::autor).orElse(null), versoes,
                mesAnterior, anteriorFechado, comparar(atual.receitas(), anterior.receitas()),
                Variacao.de(atual.totalReceitas(), anterior.totalReceitas()), comparar(atual.despesas(), anterior.despesas()),
                Variacao.de(atual.totalDespesas(), anterior.totalDespesas()),
                Variacao.de(atual.resultado(), anterior.resultado()), atual.contas(), atual.editoras(),
                atual.totalEditoras(), atual.mensalidades(), atual.recebidoMensalidades());
    }

    /** Linhas dos dois meses: o que só existiu no anterior aparece com zero no atual. */
    static List<GrupoComparado> comparar(List<Grupo> atual, List<Grupo> anterior) {
        Map<String, Grupo> antes = new LinkedHashMap<>();
        anterior.forEach(g -> antes.put(g.codigo(), g));
        Map<String, Grupo> agora = new LinkedHashMap<>();
        atual.forEach(g -> agora.put(g.codigo(), g));
        List<String> codigos = new ArrayList<>(agora.keySet());
        antes.keySet().stream().filter(c -> !agora.containsKey(c)).forEach(codigos::add);
        List<GrupoComparado> lista = new ArrayList<>();
        for (String codigo : codigos) {
            Grupo a = agora.get(codigo);
            Grupo b = antes.get(codigo);
            Map<String, Linha> subAntes = new LinkedHashMap<>();
            if (b != null) {
                b.subcategorias().forEach(l -> subAntes.put(l.codigo(), l));
            }
            List<LinhaComparada> subs = new ArrayList<>();
            if (a != null) {
                for (Linha l : a.subcategorias()) {
                    Linha x = subAntes.remove(l.codigo());
                    subs.add(new LinhaComparada(l.codigo(), l.nome(), Variacao.de(l.valor(), x == null ? null : x.valor())));
                }
            }
            subAntes.values().forEach(x -> subs.add(new LinhaComparada(x.codigo(), x.nome(), Variacao.de(null, x.valor()))));
            lista.add(new GrupoComparado(codigo, a != null ? a.nome() : b.nome(),
                    Variacao.de(a == null ? null : a.valor(), b == null ? null : b.valor()), subs));
        }
        return lista;
    }

    private static List<Grupo> grupos(List<CategoriaDoMes> categorias) {
        return categorias.stream().map(c -> new Grupo(c.codigo(), c.nome(), c.valor(),
                c.subcategorias().stream().map(s -> new Linha(s.codigo(), s.nome(), s.valor())).toList())).toList();
    }

    private static BigDecimal somar(List<Grupo> grupos) {
        return grupos.stream().map(Grupo::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public record LinhaComparada(String codigo, String nome, Variacao valores) {
    }

    public record GrupoComparado(String codigo, String nome, Variacao valores, List<LinhaComparada> subcategorias) {
    }

    /**
     * @param situacao        PRELIMINAR (calculado agora) ou FECHADO (versão gravada no fechamento)
     * @param versaoVigente   falso ao consultar uma versão substituída por um novo fechamento
     * @param fechamento      quem fechou e quando (só na versão gravada)
     * @param anteriorFechado a comparação usa a versão fechada do mês anterior
     */
    public record DemonstrativoMensal(YearMonth mes, String situacao, Integer versao, boolean versaoVigente,
            Autor fechamento, List<VersaoSnapshot> versoes, YearMonth mesAnterior, boolean anteriorFechado,
            List<GrupoComparado> receitas, Variacao totalReceitas, List<GrupoComparado> despesas,
            Variacao totalDespesas, Variacao resultado, List<SaldoConta> contas, List<SaldoEditora> editoras,
            BigDecimal totalEditoras, ResumoCompetencias mensalidades, BigDecimal recebidoMensalidades) {
    }
}
