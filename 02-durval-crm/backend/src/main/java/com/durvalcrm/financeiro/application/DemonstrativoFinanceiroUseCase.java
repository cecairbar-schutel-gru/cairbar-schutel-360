package com.durvalcrm.financeiro.application;

import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort.MovimentoConta;
import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.financeiro.domain.TipoConta;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.transaction.annotation.Transactional;

/**
 * Números do Financeiro para o fechamento mensal (US-CLOSING-001, 007): receitas e despesas por
 * categoria e subcategoria (regime de caixa, classificação atual, estornos na data em que foram
 * lançados), movimento de cada conta no mês e a situação de Cartão a receber.
 */
public class DemonstrativoFinanceiroUseCase {

    private final ContaFinanceiraRepository contas;
    private final CategoriaRepository categorias;
    private final ConsultaFinanceiraPort consulta;

    public DemonstrativoFinanceiroUseCase(ContaFinanceiraRepository contas, CategoriaRepository categorias,
            ConsultaFinanceiraPort consulta) {
        this.contas = contas;
        this.categorias = categorias;
        this.consulta = consulta;
    }

    /** Primeiro período do sistema: o mês da data de corte mais antiga entre caixas e contas bancárias. */
    @Transactional(readOnly = true)
    public Optional<YearMonth> primeiroPeriodo() {
        return contas.listar().stream()
                .filter(c -> c.tipo() != TipoConta.CARTAO_A_RECEBER)
                .map(ContaFinanceira::dataCorte)
                .min(Comparator.naturalOrder())
                .map(YearMonth::from);
    }

    /** Receitas e despesas do mês por categoria-mãe, cada uma com as subcategorias que tiveram valor. */
    @Transactional(readOnly = true)
    public ResultadoPorCategoria porCategoria(YearMonth mes) {
        Map<String, BigDecimal> somas = consulta.somaPorCategoria(mes.atDay(1), mes.atEndOfMonth());
        Map<String, Categoria> plano = new LinkedHashMap<>();
        categorias.listar().forEach(c -> plano.put(c.codigo(), c));
        return new ResultadoPorCategoria(agrupar(plano, somas, TipoCategoria.RECEITA),
                agrupar(plano, somas, TipoCategoria.DESPESA));
    }

    /** Saldo de abertura, entradas, saídas, transferências e saldo final de cada conta no mês. */
    @Transactional(readOnly = true)
    public List<MovimentoMensalConta> movimentoPorConta(YearMonth mes) {
        LocalDate inicio = mes.atDay(1);
        LocalDate fim = mes.atEndOfMonth();
        Map<Long, BigDecimal> abertura = consulta.saldos(inicio.minusDays(1));
        Map<Long, MovimentoConta> movimentos = new LinkedHashMap<>();
        consulta.movimentoPorConta(inicio, fim).forEach(m -> movimentos.put(m.contaId(), m));
        List<MovimentoMensalConta> lista = new ArrayList<>();
        for (ContaFinanceira c : contas.listar()) {
            if (c.dataCorte().isAfter(fim)) {
                continue;
            }
            MovimentoConta m = movimentos.getOrDefault(c.id(), new MovimentoConta(c.id(), BigDecimal.ZERO,
                    BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO));
            BigDecimal inicial = abertura.getOrDefault(c.id(), c.saldoInicial());
            BigDecimal saldoFinal = inicial.add(m.entradas()).subtract(m.saidas()).add(m.transferenciasEntrada())
                    .subtract(m.transferenciasSaida());
            boolean semMovimento = m.entradas().signum() == 0 && m.saidas().signum() == 0
                    && m.transferenciasEntrada().signum() == 0 && m.transferenciasSaida().signum() == 0;
            // Conta inativa sem saldo nem movimento no mês não entra no demonstrativo.
            if (!c.ativa() && semMovimento && inicial.signum() == 0) {
                continue;
            }
            lista.add(new MovimentoMensalConta(c.id(), c.nome(), c.tipo(), inicial, m.entradas(), m.saidas(),
                    m.transferenciasEntrada(), m.transferenciasSaida(), saldoFinal));
        }
        lista.sort(Comparator.comparing((MovimentoMensalConta x) -> x.tipo().ordinal())
                .thenComparing(MovimentoMensalConta::nome, String.CASE_INSENSITIVE_ORDER));
        return lista;
    }

    /** Item "Liquidações de cartão" do checklist: saldo de Cartão a receber no fim do mês e a última liquidação. */
    @Transactional(readOnly = true)
    public SituacaoCartao cartaoNoFimDo(YearMonth mes) {
        LocalDate fim = mes.atEndOfMonth();
        ContaFinanceira cartao = contas.cartaoAReceber();
        BigDecimal saldo = consulta.saldos(fim).getOrDefault(cartao.id(), cartao.saldoInicial());
        return new SituacaoCartao(saldo, consulta.ultimaLiquidacaoCartao(fim).orElse(null));
    }

    private static List<CategoriaDoMes> agrupar(Map<String, Categoria> plano, Map<String, BigDecimal> somas,
            TipoCategoria tipo) {
        Map<String, List<LinhaDoMes>> porMae = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> e : somas.entrySet()) {
            Categoria sub = plano.get(e.getKey());
            if (sub == null || sub.tipo() != tipo || e.getValue().signum() == 0) {
                continue;
            }
            // Receitas somam positivo; despesas vêm negativas das linhas e são mostradas positivas.
            BigDecimal valor = tipo == TipoCategoria.RECEITA ? e.getValue() : e.getValue().negate();
            String mae = sub.categoriaPai() == null ? sub.codigo() : sub.categoriaPai();
            porMae.computeIfAbsent(mae, k -> new ArrayList<>()).add(new LinhaDoMes(sub.codigo(), sub.nome(), valor));
        }
        List<CategoriaDoMes> lista = new ArrayList<>();
        for (Map.Entry<String, List<LinhaDoMes>> e : porMae.entrySet()) {
            Categoria mae = plano.get(e.getKey());
            List<LinhaDoMes> subs = e.getValue().stream()
                    .sorted(Comparator.comparing(LinhaDoMes::nome, String.CASE_INSENSITIVE_ORDER)).toList();
            lista.add(new CategoriaDoMes(e.getKey(), mae == null ? e.getKey() : mae.nome(),
                    subs.stream().map(LinhaDoMes::valor).reduce(BigDecimal.ZERO, BigDecimal::add), subs));
        }
        lista.sort(Comparator.comparing(CategoriaDoMes::nome, String.CASE_INSENSITIVE_ORDER));
        return lista;
    }

    public record LinhaDoMes(String codigo, String nome, BigDecimal valor) {
    }

    public record CategoriaDoMes(String codigo, String nome, BigDecimal valor, List<LinhaDoMes> subcategorias) {
    }

    public record ResultadoPorCategoria(List<CategoriaDoMes> receitas, List<CategoriaDoMes> despesas) {
    }

    /**
     * Transferências incluem as liquidações de cartão (Cartão a receber → banco, pelo líquido; a taxa
     * fica nas despesas) e os estornos delas.
     */
    public record MovimentoMensalConta(long contaId, String nome, TipoConta tipo, BigDecimal saldoInicial,
            BigDecimal entradas, BigDecimal saidas, BigDecimal transferenciasEntrada, BigDecimal transferenciasSaida,
            BigDecimal saldoFinal) {
    }

    /** {@code ultimaLiquidacao}: data da última liquidação até o fim do mês (nula se nenhuma). */
    public record SituacaoCartao(BigDecimal saldoNoFimDoMes, LocalDate ultimaLiquidacao) {
    }
}
