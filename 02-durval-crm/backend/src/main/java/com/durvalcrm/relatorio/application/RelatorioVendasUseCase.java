package com.durvalcrm.relatorio.application;

import com.durvalcrm.relatorio.application.VendasParaRelatorioPort.EventoVenda;
import com.durvalcrm.relatorio.application.VendasParaRelatorioPort.ItemVendido;
import com.durvalcrm.relatorio.application.VendasParaRelatorioPort.PagamentoVenda;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relatório de vendas (US-REPORT-006). Vendas contam pela data financeira e o cancelamento entra na
 * data do estorno, descontando a venda original: receita líquida = vendas − canceladas. Livros,
 * cantina, meios de pagamento, produtos e vendedores mostram o líquido. O Vendedor vê as vendas que
 * fez e as do PDV da cantina; a Tesouraria vê todas.
 */
public class RelatorioVendasUseCase {

    /** Cartão sem tipo (vendas anteriores a 27/10/2026) entra no fim, só quando houver. */
    static final List<String> MEIOS = List.of("DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO");

    private final VendasParaRelatorioPort vendas;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public RelatorioVendasUseCase(VendasParaRelatorioPort vendas, CurrentUserPort usuario, Clock relogio) {
        this.vendas = vendas;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    public record MeioValor(String meio, BigDecimal valor) {
    }

    public record ProdutoVendido(long produtoId, String nome, String tipo, long quantidade, BigDecimal valor) {
    }

    /** {@code nome}: nome do vendedor na venda (o subject quando não há nome). */
    public record VendasDoVendedor(String vendedorSubject, String nome, long vendas, BigDecimal bruto, long canceladas,
            BigDecimal cancelado, BigDecimal liquido) {
    }

    /**
     * @param vendas         vendas confirmadas no período (mesmo que canceladas depois)
     * @param canceladas     vendas canceladas no período (de qualquer data)
     */
    public record RelatorioVendas(LocalDate de, LocalDate ate, long vendas, BigDecimal receitaBruta,
            long canceladas, BigDecimal valorCancelado, BigDecimal receitaLiquida, BigDecimal livros,
            BigDecimal cantina, List<MeioValor> porMeio, List<ProdutoVendido> porProduto,
            List<VendasDoVendedor> porVendedor) {
    }

    @Transactional(readOnly = true)
    public RelatorioVendas gerar(PeriodoRelatorio periodo) {
        List<EventoVenda> eventos = vendas.eventos(periodo.de(), periodo.ate(),
                veTodasAsVendas() ? null : usuario.getSubject());

        long quantidade = 0;
        long canceladas = 0;
        BigDecimal bruto = BigDecimal.ZERO;
        BigDecimal cancelado = BigDecimal.ZERO;
        BigDecimal livros = BigDecimal.ZERO;
        BigDecimal cantina = BigDecimal.ZERO;
        Map<String, BigDecimal> porMeio = new LinkedHashMap<>();
        MEIOS.forEach(m -> porMeio.put(m, BigDecimal.ZERO));
        Map<Long, ProdutoVendido> porProduto = new LinkedHashMap<>();
        Map<String, VendasDoVendedor> porVendedor = new LinkedHashMap<>();
        for (EventoVenda e : eventos) {
            int sinal = e.cancelamento() ? -1 : 1;
            if (e.cancelamento()) {
                canceladas++;
                cancelado = cancelado.add(e.total());
            } else {
                quantidade++;
                bruto = bruto.add(e.total());
            }
            for (ItemVendido i : e.itens()) {
                BigDecimal valor = i.valor().multiply(BigDecimal.valueOf(sinal));
                if ("LIVRO".equals(i.tipo())) {
                    livros = livros.add(valor);
                } else {
                    cantina = cantina.add(valor);
                }
                ProdutoVendido p = porProduto.getOrDefault(i.produtoId(),
                        new ProdutoVendido(i.produtoId(), i.nome(), i.tipo(), 0, BigDecimal.ZERO));
                porProduto.put(i.produtoId(), new ProdutoVendido(p.produtoId(), p.nome(), p.tipo(),
                        p.quantidade() + (long) sinal * i.quantidade(), p.valor().add(valor)));
            }
            for (PagamentoVenda p : e.pagamentos()) {
                porMeio.merge(p.meio(), p.valor().multiply(BigDecimal.valueOf(sinal)), BigDecimal::add);
            }
            String nome = e.vendedorNome() == null ? e.vendedorSubject() : e.vendedorNome();
            VendasDoVendedor c = porVendedor.getOrDefault(e.vendedorSubject(), new VendasDoVendedor(
                    e.vendedorSubject(), nome, 0, BigDecimal.ZERO, 0, BigDecimal.ZERO, BigDecimal.ZERO));
            porVendedor.put(e.vendedorSubject(), e.cancelamento()
                    ? new VendasDoVendedor(c.vendedorSubject(), c.nome(), c.vendas(), c.bruto(), c.canceladas() + 1,
                            c.cancelado().add(e.total()), c.liquido().subtract(e.total()))
                    : new VendasDoVendedor(c.vendedorSubject(), c.nome(), c.vendas() + 1, c.bruto().add(e.total()),
                            c.canceladas(), c.cancelado(), c.liquido().add(e.total())));
        }
        List<ProdutoVendido> produtos = new ArrayList<>(porProduto.values().stream()
                .filter(p -> p.quantidade() != 0 || p.valor().signum() != 0).toList());
        produtos.sort(Comparator.comparing(ProdutoVendido::valor).reversed()
                .thenComparing(ProdutoVendido::nome, String.CASE_INSENSITIVE_ORDER));
        List<VendasDoVendedor> vendedores = new ArrayList<>(porVendedor.values());
        vendedores.sort(Comparator.comparing(VendasDoVendedor::nome, String.CASE_INSENSITIVE_ORDER));
        return new RelatorioVendas(periodo.de(), periodo.ate(), quantidade, bruto, canceladas, cancelado,
                bruto.subtract(cancelado), livros, cantina,
                porMeio.entrySet().stream().map(m -> new MeioValor(m.getKey(), m.getValue())).toList(), produtos,
                vendedores);
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    private boolean veTodasAsVendas() {
        return usuario.hasRole("tesoureiro") || usuario.hasRole("administrador");
    }
}
