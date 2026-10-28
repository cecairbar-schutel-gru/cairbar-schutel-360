package com.durvalcrm.relatorio.application;

import com.durvalcrm.financeiro.application.ConciliacoesPort;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.LinhasDoLancamento;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import com.durvalcrm.relatorio.application.ArvoreCategorias.GrupoCategoria;
import com.durvalcrm.relatorio.domain.Agrupamento;
import com.durvalcrm.relatorio.domain.Agrupamento.Intervalo;
import com.durvalcrm.relatorio.domain.Centavos;
import com.durvalcrm.relatorio.domain.FluxoDeCaixa;
import com.durvalcrm.relatorio.domain.FluxoDeCaixa.Parcela;
import com.durvalcrm.relatorio.domain.MovimentoRazao;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import com.durvalcrm.shared.domain.RecursoNaoEncontradoException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relatórios do razão: fluxo de caixa (US-REPORT-001), receitas e despesas por categoria (002) e
 * saldos por conta (003). Regime de caixa (data financeira), estornos na data em que foram lançados
 * e classificação atual de cada lançamento; transferências internas nunca são receita nem despesa.
 */
public class RelatoriosFinanceirosUseCase {

    private final ContaFinanceiraRepository contas;
    private final CategoriaRepository categorias;
    private final ConsultaFinanceiraPort consulta;
    private final ConciliacoesPort conciliacoes;
    private final Clock relogio;

    public RelatoriosFinanceirosUseCase(ContaFinanceiraRepository contas, CategoriaRepository categorias,
            ConsultaFinanceiraPort consulta, ConciliacoesPort conciliacoes, Clock relogio) {
        this.contas = contas;
        this.categorias = categorias;
        this.consulta = consulta;
        this.conciliacoes = conciliacoes;
        this.relogio = relogio;
    }

    public record ContaDoRelatorio(long contaId, String nome, TipoConta tipo) {
    }

    /** Uma linha do agrupamento escolhido (dia, semana ou mês). */
    public record LinhaFluxo(LocalDate inicio, LocalDate fim, BigDecimal saldoInicial, BigDecimal entradas,
            BigDecimal saidas, BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida, BigDecimal saldoFinal) {
    }

    /**
     * Saldo inicial + entradas − saídas + transferências recebidas − enviadas = saldo final, que é o
     * saldo das contas escolhidas no fim do período.
     */
    public record FluxoCaixa(LocalDate de, LocalDate ate, Agrupamento agrupamento, Long contaId, TipoConta tipoConta,
            List<ContaDoRelatorio> contas, BigDecimal saldoInicial, List<GrupoCategoria> entradas,
            BigDecimal totalEntradas, List<GrupoCategoria> saidas, BigDecimal totalSaidas,
            BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida, BigDecimal saldoFinal,
            List<LinhaFluxo> periodos) {
    }

    public record ReceitasDespesas(LocalDate de, LocalDate ate, List<GrupoCategoria> receitas, BigDecimal totalReceitas,
            List<GrupoCategoria> despesas, BigDecimal totalDespesas, BigDecimal resultado) {
    }

    /**
     * No modo "saldo na data" só o saldo final vem preenchido.
     *
     * @param conciliadaAte só nas contas bancárias: data final da última conciliação concluída
     */
    public record SaldoConta(long contaId, String nome, TipoConta tipo, boolean ativa, BigDecimal saldoInicial,
            BigDecimal entradas, BigDecimal saidas, BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida,
            BigDecimal saldoFinal, LocalDate conciliadaAte) {
    }

    public record TotaisSaldos(BigDecimal saldoInicial, BigDecimal entradas, BigDecimal saidas,
            BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida, BigDecimal saldoFinal) {
    }

    public record GrupoSaldos(TipoConta tipo, List<SaldoConta> contas, TotaisSaldos totais) {
    }

    /**
     * Caixas e bancos são o disponível; Cartão a receber fica à parte, como valor a receber.
     *
     * @param modo PERIODO (de/até) ou DATA (saldos no fim do dia {@code ate})
     */
    public record SaldosPorConta(String modo, LocalDate de, LocalDate ate, List<GrupoSaldos> grupos,
            TotaisSaldos totalDisponivel, SaldoConta cartaoAReceber, BigDecimal totalComRecebiveis) {
    }

    /** US-REPORT-001. Sem conta nem tipo: todas as contas. */
    @Transactional(readOnly = true)
    public FluxoCaixa fluxoCaixa(PeriodoRelatorio periodo, Agrupamento agrupamento, Long contaId, TipoConta tipoConta) {
        Agrupamento grupo = agrupamento == null ? Agrupamento.MES : agrupamento;
        List<ContaFinanceira> escolhidas = escolher(contaId, tipoConta, periodo.ate());
        Set<Long> ids = escolhidas.stream().map(ContaFinanceira::id).collect(Collectors.toSet());
        List<Categoria> plano = categorias.listar();
        Set<String> receitas = plano.stream().filter(c -> c.tipo() == TipoCategoria.RECEITA).map(Categoria::codigo)
                .collect(Collectors.toSet());

        long saldo = soma(consulta.saldos(periodo.de().minusDays(1)), escolhidas);
        long abertura = saldo;
        List<MovimentoRazao> movimentos = movimentos(periodo);
        FluxoDeCaixa fluxo = new FluxoDeCaixa(ids, receitas);
        List<LinhaFluxo> linhas = new ArrayList<>();
        int i = 0;
        for (Intervalo intervalo : grupo.intervalos(periodo)) {
            Parcela parcela = Parcela.ZERO;
            while (i < movimentos.size() && !movimentos.get(i).data().isAfter(intervalo.fim())) {
                parcela = parcela.mais(fluxo.somar(movimentos.get(i++)));
            }
            long fim = saldo + parcela.liquido();
            linhas.add(new LinhaFluxo(intervalo.inicio(), intervalo.fim(), Centavos.reais(saldo),
                    Centavos.reais(parcela.entradas()), Centavos.reais(parcela.saidas()),
                    Centavos.reais(parcela.transferenciasEntrada()), Centavos.reais(parcela.transferenciasSaida()),
                    Centavos.reais(fim)));
            saldo = fim;
        }
        List<GrupoCategoria> entradas = ArvoreCategorias.montar(plano, TipoCategoria.RECEITA, reais(fluxo.entradas()), false);
        List<GrupoCategoria> saidas = ArvoreCategorias.montar(plano, TipoCategoria.DESPESA, reais(fluxo.saidas()), false);
        return new FluxoCaixa(periodo.de(), periodo.ate(), grupo, contaId, contaId == null ? tipoConta : null,
                escolhidas.stream().map(c -> new ContaDoRelatorio(c.id(), c.nome(), c.tipo())).toList(),
                Centavos.reais(abertura), entradas, ArvoreCategorias.total(entradas), saidas,
                ArvoreCategorias.total(saidas), Centavos.reais(fluxo.transferenciasEntrada()),
                Centavos.reais(fluxo.transferenciasSaida()), Centavos.reais(saldo), linhas);
    }

    /** US-REPORT-002: todo o plano de contas ativo, mais as categorias inativas que tiveram lançamentos. */
    @Transactional(readOnly = true)
    public ReceitasDespesas porCategoria(PeriodoRelatorio periodo) {
        List<Categoria> plano = categorias.listar();
        Map<String, Categoria> porCodigo = plano.stream().collect(Collectors.toMap(Categoria::codigo, Function.identity()));
        Map<String, BigDecimal> receitas = new HashMap<>();
        Map<String, BigDecimal> despesas = new HashMap<>();
        consulta.somaPorCategoria(periodo.de(), periodo.ate()).forEach((codigo, valor) -> {
            Categoria c = porCodigo.get(codigo);
            if (c == null) {
                return;
            }
            // Receitas somam positivo; despesas vêm negativas das linhas e são mostradas positivas.
            if (c.tipo() == TipoCategoria.RECEITA) {
                receitas.put(codigo, valor);
            } else {
                despesas.put(codigo, valor.negate());
            }
        });
        List<GrupoCategoria> r = ArvoreCategorias.montar(plano, TipoCategoria.RECEITA, receitas, true);
        List<GrupoCategoria> d = ArvoreCategorias.montar(plano, TipoCategoria.DESPESA, despesas, true);
        BigDecimal totalReceitas = ArvoreCategorias.total(r);
        BigDecimal totalDespesas = ArvoreCategorias.total(d);
        return new ReceitasDespesas(periodo.de(), periodo.ate(), r, totalReceitas, d, totalDespesas,
                totalReceitas.subtract(totalDespesas));
    }

    /** US-REPORT-003 no período: abertura, entradas, saídas, transferências e saldo final de cada conta. */
    @Transactional(readOnly = true)
    public SaldosPorConta saldos(PeriodoRelatorio periodo) {
        Map<Long, BigDecimal> abertura = consulta.saldos(periodo.de().minusDays(1));
        Map<Long, BigDecimal> fechamento = consulta.saldos(periodo.ate());
        List<MovimentoRazao> movimentos = movimentos(periodo);
        Set<String> receitas = categorias.listar().stream().filter(c -> c.tipo() == TipoCategoria.RECEITA)
                .map(Categoria::codigo).collect(Collectors.toSet());
        Map<Long, LocalDate> conciliadas = conciliacoes.conciliadasAte();
        List<SaldoConta> lista = new ArrayList<>();
        for (ContaFinanceira c : contas.listar()) {
            if (c.dataCorte().isAfter(periodo.ate())) {
                continue;
            }
            Parcela p = new FluxoDeCaixa(Set.of(c.id()), receitas).somarTodos(movimentos);
            BigDecimal inicial = abertura.getOrDefault(c.id(), c.saldoInicial());
            BigDecimal fim = fechamento.getOrDefault(c.id(), c.saldoInicial());
            boolean semMovimento = p.equals(Parcela.ZERO);
            // Conta inativa sem saldo nem movimento no período não entra.
            if (!c.ativa() && semMovimento && inicial.signum() == 0 && fim.signum() == 0) {
                continue;
            }
            lista.add(new SaldoConta(c.id(), c.nome(), c.tipo(), c.ativa(), inicial, Centavos.reais(p.entradas()),
                    Centavos.reais(p.saidas()), Centavos.reais(p.transferenciasEntrada()),
                    Centavos.reais(p.transferenciasSaida()), fim,
                    c.tipo() == TipoConta.BANCO ? conciliadas.get(c.id()) : null));
        }
        return quadro("PERIODO", periodo.de(), periodo.ate(), lista);
    }

    /** US-REPORT-003, modo "saldo na data": saldos no fim do dia. */
    @Transactional(readOnly = true)
    public SaldosPorConta saldosNaData(LocalDate data) {
        if (data == null) {
            throw ValidacaoException.doCampo("data", "Informe a data.");
        }
        Map<Long, BigDecimal> saldos = consulta.saldos(data);
        Map<Long, LocalDate> conciliadas = conciliacoes.conciliadasAte();
        List<SaldoConta> lista = new ArrayList<>();
        for (ContaFinanceira c : contas.listar()) {
            BigDecimal saldo = saldos.getOrDefault(c.id(), c.saldoInicial());
            if (c.dataCorte().isAfter(data) || (!c.ativa() && saldo.signum() == 0)) {
                continue;
            }
            lista.add(new SaldoConta(c.id(), c.nome(), c.tipo(), c.ativa(), null, null, null, null, null, saldo,
                    c.tipo() == TipoConta.BANCO ? conciliadas.get(c.id()) : null));
        }
        return quadro("DATA", null, data, lista);
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    private SaldosPorConta quadro(String modo, LocalDate de, LocalDate ate, List<SaldoConta> lista) {
        boolean naData = "DATA".equals(modo);
        List<GrupoSaldos> grupos = new ArrayList<>();
        for (TipoConta tipo : List.of(TipoConta.CAIXA, TipoConta.BANCO)) {
            List<SaldoConta> doTipo = lista.stream().filter(s -> s.tipo() == tipo).toList();
            grupos.add(new GrupoSaldos(tipo, doTipo, totais(doTipo, naData)));
        }
        TotaisSaldos disponivel = totais(grupos.stream().flatMap(g -> g.contas().stream()).toList(), naData);
        SaldoConta cartao = lista.stream().filter(s -> s.tipo() == TipoConta.CARTAO_A_RECEBER).findFirst().orElse(null);
        BigDecimal comRecebiveis = disponivel.saldoFinal().add(cartao == null ? BigDecimal.ZERO : cartao.saldoFinal());
        return new SaldosPorConta(modo, de, ate, grupos, disponivel, cartao, comRecebiveis);
    }

    /** No modo "saldo na data" só o saldo final é somado. */
    private static TotaisSaldos totais(List<SaldoConta> lista, boolean naData) {
        BigDecimal fim = somar(lista, SaldoConta::saldoFinal);
        if (naData) {
            return new TotaisSaldos(null, null, null, null, null, fim);
        }
        return new TotaisSaldos(somar(lista, SaldoConta::saldoInicial), somar(lista, SaldoConta::entradas),
                somar(lista, SaldoConta::saidas), somar(lista, SaldoConta::transferenciasEntrada),
                somar(lista, SaldoConta::transferenciasSaida), fim);
    }

    private static BigDecimal somar(List<SaldoConta> lista, Function<SaldoConta, BigDecimal> campo) {
        return lista.stream().map(campo).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<ContaFinanceira> escolher(Long contaId, TipoConta tipo, LocalDate ate) {
        List<ContaFinanceira> todas = contas.listar();
        if (contaId != null) {
            ContaFinanceira conta = todas.stream().filter(c -> c.id() == contaId).findFirst()
                    .orElseThrow(() -> new RecursoNaoEncontradoException("CONTA_NAO_ENCONTRADA", "Conta não encontrada."));
            return List.of(conta);
        }
        return todas.stream().filter(c -> tipo == null || c.tipo() == tipo)
                .filter(c -> !c.dataCorte().isAfter(ate)).toList();
    }

    private List<MovimentoRazao> movimentos(PeriodoRelatorio periodo) {
        return consulta.linhasNoPeriodo(periodo.de(), periodo.ate()).stream().map(RelatoriosFinanceirosUseCase::emCentavos)
                .toList();
    }

    private static MovimentoRazao emCentavos(LinhasDoLancamento l) {
        Map<Long, Long> contas = new HashMap<>();
        l.contas().forEach((k, v) -> contas.put(k, Centavos.de(v)));
        Map<String, Long> categorias = new HashMap<>();
        l.categorias().forEach((k, v) -> categorias.put(k, Centavos.de(v)));
        return new MovimentoRazao(l.id(), l.data(), contas, categorias);
    }

    private static long soma(Map<Long, BigDecimal> saldos, List<ContaFinanceira> escolhidas) {
        return escolhidas.stream().mapToLong(c -> Centavos.de(saldos.getOrDefault(c.id(), c.saldoInicial()))).sum();
    }

    private static Map<String, BigDecimal> reais(Map<String, Long> centavos) {
        Map<String, BigDecimal> m = new HashMap<>();
        centavos.forEach((k, v) -> m.put(k, Centavos.reais(v)));
        return m;
    }
}
