package com.durvalcrm.relatorio.application;

import com.durvalcrm.relatorio.application.EstoqueParaRelatorioPort.LoteEstoque;
import com.durvalcrm.relatorio.application.EstoqueParaRelatorioPort.ProdutoEstoque;
import com.durvalcrm.relatorio.application.EstoqueParaRelatorioPort.SomaMovimentos;
import com.durvalcrm.relatorio.domain.ColunaEstoque;
import com.durvalcrm.relatorio.domain.PeriodoRelatorio;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relatório de estoque (US-REPORT-007; Spec §8 "Estoque físico e do sistema compatíveis"): por
 * produto e origem (próprio ou remessa consignada), o saldo inicial, as entradas, as saídas, os
 * ajustes e o saldo final do período; as baixas por motivo; e a folha de contagem do inventário.
 * Os saldos partem do saldo atual dos lotes descontando os movimentos posteriores.
 */
public class RelatorioEstoqueUseCase {

    static final List<String> MOTIVOS = List.of("VENCIMENTO", "DANO", "EXTRAVIO");

    private final EstoqueParaRelatorioPort estoque;
    private final Clock relogio;

    public RelatorioEstoqueUseCase(EstoqueParaRelatorioPort estoque, Clock relogio) {
        this.estoque = estoque;
        this.relogio = relogio;
    }

    /**
     * Uma origem do produto. Entradas e ajustes com o sinal; saídas positivas:
     * {@code fim = inicial + compra + doacao + remessa − venda − devolucao − baixa + ajuste}.
     *
     * @param origem PROPRIO, CONSIGNADO ou TOTAL (soma das origens)
     */
    public record LinhaEstoque(String origem, Long remessaId, String remessaCodigo, Long editoraId, String editoraNome,
            int inicial, int compra, int doacao, int remessa, int venda, int devolucao, int baixa, int ajuste,
            int fim) {

        boolean semMovimento() {
            return compra == 0 && doacao == 0 && remessa == 0 && venda == 0 && devolucao == 0 && baixa == 0
                    && ajuste == 0;
        }

        boolean vazia() {
            return semMovimento() && inicial == 0 && fim == 0;
        }

        LinhaEstoque mais(LinhaEstoque o, String comoOrigem) {
            return new LinhaEstoque(comoOrigem, null, null, null, null, inicial + o.inicial, compra + o.compra,
                    doacao + o.doacao, remessa + o.remessa, venda + o.venda, devolucao + o.devolucao, baixa + o.baixa,
                    ajuste + o.ajuste, fim + o.fim);
        }

        static LinhaEstoque vazia(String origem) {
            return new LinhaEstoque(origem, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
    }

    public record ProdutoNoRelatorio(long produtoId, String nome, String tipo, String categoria, String autor,
            String editoraNome, boolean ativo, List<LinhaEstoque> origens, LinhaEstoque total) {
    }

    public record BaixaPorMotivo(String motivo, int quantidade) {
    }

    public record RelatorioEstoque(LocalDate de, LocalDate ate, String tipo, String categoria, Long editoraId,
            boolean somenteComMovimento, List<ProdutoNoRelatorio> produtos, LinhaEstoque total,
            List<BaixaPorMotivo> baixasPorMotivo) {
    }

    /** Linha da folha de contagem: a coluna "contado" fica em branco para o inventário físico. */
    public record ItemContagem(long produtoId, String nome, String tipo, String categoria, String autor,
            String editoraNome, int proprio, int consignado, int quantidade) {
    }

    public record FolhaContagem(LocalDate data, String tipo, String categoria, Long editoraId, List<ItemContagem> itens) {
    }

    @Transactional(readOnly = true)
    public RelatorioEstoque gerar(PeriodoRelatorio periodo, String tipo, String categoria, Long editoraId,
            boolean somenteComMovimento) {
        List<ProdutoEstoque> produtos = estoque.produtos(vazioParaNulo(tipo), vazioParaNulo(categoria), editoraId);
        List<Long> ids = produtos.stream().map(ProdutoEstoque::id).toList();
        Instant inicio = periodo.de().atStartOfDay(relogio.getZone()).toInstant();
        Instant fim = periodo.ate().plusDays(1).atStartOfDay(relogio.getZone()).toInstant();

        Map<String, Lote> lotes = new LinkedHashMap<>();
        if (!ids.isEmpty()) {
            for (LoteEstoque l : estoque.lotes(ids)) {
                lotes.put(chave(l.produtoId(), l.remessaId()), new Lote(l));
            }
        }
        Map<String, Integer> baixas = new LinkedHashMap<>();
        MOTIVOS.forEach(m -> baixas.put(m, 0));
        if (!ids.isEmpty()) {
            for (SomaMovimentos m : estoque.movimentos(ids, inicio, fim)) {
                Lote lote = lotes.computeIfAbsent(chave(m.produtoId(), m.remessaId()),
                        k -> new Lote(new LoteEstoque(m.produtoId(), m.remessaId(), null, null, null, 0)));
                ColunaEstoque coluna = ColunaEstoque.de(m.tipo(), m.tipoEstornado());
                lote.colunas.merge(coluna, coluna.naColuna(m.noPeriodo()), Integer::sum);
                lote.noPeriodo += m.noPeriodo();
                lote.depois += m.depois();
                String motivo = ColunaEstoque.motivoBaixa(m.tipo(), m.tipoEstornado());
                if (motivo != null) {
                    baixas.merge(motivo, -m.noPeriodo(), Integer::sum);
                }
            }
        }

        List<ProdutoNoRelatorio> lista = new ArrayList<>();
        LinhaEstoque total = LinhaEstoque.vazia("TOTAL");
        for (ProdutoEstoque p : produtos) {
            List<LinhaEstoque> origens = lotes.values().stream().filter(l -> l.base.produtoId() == p.id())
                    .sorted(Comparator.comparing((Lote l) -> l.base.remessaId() != null)
                            .thenComparing(l -> Objects.requireNonNullElse(l.base.remessaCodigo(), "")))
                    .map(Lote::linha).filter(l -> !l.vazia()).toList();
            if (origens.isEmpty()) {
                origens = List.of(LinhaEstoque.vazia("PROPRIO"));
            }
            LinhaEstoque soma = origens.stream().reduce(LinhaEstoque.vazia("TOTAL"), (a, b) -> a.mais(b, "TOTAL"));
            if (somenteComMovimento && soma.semMovimento()) {
                continue;
            }
            if (!p.ativo() && soma.vazia()) {
                continue;
            }
            lista.add(new ProdutoNoRelatorio(p.id(), p.nome(), p.tipo(), p.categoria(), p.autor(), p.editoraNome(),
                    p.ativo(), origens, soma));
            total = total.mais(soma, "TOTAL");
        }
        return new RelatorioEstoque(periodo.de(), periodo.ate(), vazioParaNulo(tipo), vazioParaNulo(categoria),
                editoraId, somenteComMovimento, lista, total,
                baixas.entrySet().stream().map(e -> new BaixaPorMotivo(e.getKey(), e.getValue())).toList());
    }

    /** Saldo atual de cada produto ativo com os filtros (e dos inativos que ainda têm saldo). */
    @Transactional(readOnly = true)
    public FolhaContagem contagem(String tipo, String categoria, Long editoraId) {
        List<ProdutoEstoque> produtos = estoque.produtos(vazioParaNulo(tipo), vazioParaNulo(categoria), editoraId);
        Map<Long, int[]> saldos = new LinkedHashMap<>();
        if (!produtos.isEmpty()) {
            for (LoteEstoque l : estoque.lotes(produtos.stream().map(ProdutoEstoque::id).toList())) {
                int[] s = saldos.computeIfAbsent(l.produtoId(), k -> new int[2]);
                s[l.remessaId() == null ? 0 : 1] += l.quantidade();
            }
        }
        List<ItemContagem> itens = new ArrayList<>();
        for (ProdutoEstoque p : produtos) {
            int[] s = saldos.getOrDefault(p.id(), new int[2]);
            if (!p.ativo() && s[0] + s[1] == 0) {
                continue;
            }
            itens.add(new ItemContagem(p.id(), p.nome(), p.tipo(), p.categoria(), p.autor(), p.editoraNome(), s[0], s[1],
                    s[0] + s[1]));
        }
        return new FolhaContagem(LocalDate.now(relogio), vazioParaNulo(tipo), vazioParaNulo(categoria), editoraId, itens);
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    private static String chave(long produtoId, Long remessaId) {
        return produtoId + ":" + remessaId;
    }

    private static String vazioParaNulo(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    /** Acumulador de um lote durante o cálculo. */
    private static final class Lote {
        final LoteEstoque base;
        final Map<ColunaEstoque, Integer> colunas = new EnumMap<>(ColunaEstoque.class);
        int noPeriodo;
        int depois;

        Lote(LoteEstoque base) {
            this.base = base;
        }

        LinhaEstoque linha() {
            int fim = base.quantidade() - depois;
            int inicial = fim - noPeriodo;
            return new LinhaEstoque(base.remessaId() == null ? "PROPRIO" : "CONSIGNADO", base.remessaId(),
                    base.remessaCodigo(), base.editoraId(), base.editoraNome(), inicial, c(ColunaEstoque.COMPRA),
                    c(ColunaEstoque.DOACAO), c(ColunaEstoque.REMESSA), c(ColunaEstoque.VENDA), c(ColunaEstoque.DEVOLUCAO),
                    c(ColunaEstoque.BAIXA), c(ColunaEstoque.AJUSTE), fim);
        }

        private int c(ColunaEstoque coluna) {
            return colunas.getOrDefault(coluna, 0);
        }
    }
}
