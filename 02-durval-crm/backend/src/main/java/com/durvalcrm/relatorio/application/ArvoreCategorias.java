package com.durvalcrm.relatorio.application;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.relatorio.domain.Percentual;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Árvore do plano de contas (Spec §5: categoria e um nível de subcategoria) com os valores de um
 * relatório e a participação de cada linha no total do grupo (receitas ou despesas).
 */
public final class ArvoreCategorias {

    private ArvoreCategorias() {
    }

    /** Subcategoria com o valor e a participação no total do grupo. */
    public record LinhaCategoria(String codigo, String nome, boolean ativa, BigDecimal valor, BigDecimal percentual) {
    }

    public record GrupoCategoria(String codigo, String nome, boolean ativa, BigDecimal valor, BigDecimal percentual,
            List<LinhaCategoria> subcategorias) {
    }

    /**
     * @param valores    por subcategoria, já positivos para o grupo (receita recebida, despesa paga)
     * @param planoTodo  mostra todas as subcategorias ativas, mesmo sem valor; as inativas entram só
     *                   quando aparecem em {@code valores}
     */
    static List<GrupoCategoria> montar(List<Categoria> plano, TipoCategoria tipo, Map<String, BigDecimal> valores,
            boolean planoTodo) {
        Map<String, Categoria> maes = new LinkedHashMap<>();
        Map<String, List<Categoria>> filhas = new LinkedHashMap<>();
        for (Categoria c : plano) {
            if (c.tipo() != tipo) {
                continue;
            }
            if (c.subcategoria()) {
                filhas.computeIfAbsent(c.categoriaPai(), k -> new ArrayList<>()).add(c);
            } else {
                maes.put(c.codigo(), c);
            }
        }
        BigDecimal total = valores.entrySet().stream()
                .filter(e -> plano.stream().anyMatch(c -> c.codigo().equals(e.getKey()) && c.tipo() == tipo))
                .map(Map.Entry::getValue).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<GrupoCategoria> grupos = new ArrayList<>();
        for (Categoria mae : maes.values()) {
            List<LinhaCategoria> subs = new ArrayList<>();
            for (Categoria sub : filhas.getOrDefault(mae.codigo(), List.of())) {
                boolean temValor = valores.containsKey(sub.codigo());
                if (!temValor && !(planoTodo && sub.ativa())) {
                    continue;
                }
                BigDecimal valor = valores.getOrDefault(sub.codigo(), BigDecimal.ZERO);
                subs.add(new LinhaCategoria(sub.codigo(), sub.nome(), sub.ativa(), valor, Percentual.de(valor, total)));
            }
            // Lançamento direto na categoria-mãe (só em dados antigos) aparece como uma linha dela.
            if (valores.containsKey(mae.codigo())) {
                BigDecimal valor = valores.get(mae.codigo());
                subs.add(new LinhaCategoria(mae.codigo(), mae.nome(), mae.ativa(), valor, Percentual.de(valor, total)));
            }
            if (subs.isEmpty()) {
                continue;
            }
            subs.sort(Comparator.comparing(LinhaCategoria::nome, String.CASE_INSENSITIVE_ORDER));
            BigDecimal soma = subs.stream().map(LinhaCategoria::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
            grupos.add(new GrupoCategoria(mae.codigo(), mae.nome(), mae.ativa(), soma, Percentual.de(soma, total),
                    List.copyOf(subs)));
        }
        grupos.sort(Comparator.comparing(GrupoCategoria::nome, String.CASE_INSENSITIVE_ORDER));
        return grupos;
    }

    static BigDecimal total(List<GrupoCategoria> grupos) {
        return grupos.stream().map(GrupoCategoria::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
