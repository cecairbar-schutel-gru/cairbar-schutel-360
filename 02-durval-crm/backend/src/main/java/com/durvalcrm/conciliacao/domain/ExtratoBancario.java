package com.durvalcrm.conciliacao.domain;

import com.durvalcrm.financeiro.domain.Dinheiro;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Extrato do banco importado na sessão de conciliação (OFX ou CSV, lido no navegador). Só as linhas do
 * período da sessão ficam; para cada linha sem par o sistema sugere um lançamento com o mesmo valor e
 * data próxima, que o Tesoureiro confirma.
 */
public final class ExtratoBancario {

    /** Distância máxima, em dias, entre a data do extrato e a do lançamento sugerido. */
    public static final int TOLERANCIA_DIAS = 3;
    public static final int MAXIMO_LINHAS = 5000;
    public static final int TAMANHO_DESCRICAO = 255;

    private ExtratoBancario() {
    }

    public enum Formato {
        OFX,
        CSV
    }

    /** @param identificador FITID do OFX (opcional) */
    public record LinhaNova(LocalDate data, String descricao, BigDecimal valor, String identificador) {
    }

    /** @param ignoradas linhas fora do período da sessão */
    public record Selecao(List<LinhaNova> noPeriodo, int ignoradas) {
    }

    /** Linha ou lançamento a casar: o movimento na conta (+ entra, − sai). */
    public record Movimento(long id, LocalDate data, BigDecimal valor) {
    }

    /**
     * Valida o arquivo e devolve as linhas com data depois de {@code depoisDe} (fim da última
     * conciliação, ou a véspera do corte da conta) e até {@code ate} (fim do extrato da sessão).
     */
    public static Selecao selecionar(String arquivo, Formato formato, List<LinhaNova> linhas, LocalDate depoisDe,
            LocalDate ate) {
        List<ErroCampo> erros = new ArrayList<>();
        if (arquivo == null || arquivo.isBlank()) {
            erros.add(new ErroCampo("arquivo", "Informe o nome do arquivo do extrato."));
        }
        if (formato == null) {
            erros.add(new ErroCampo("formato", "O extrato deve ser OFX ou CSV."));
        }
        if (linhas == null || linhas.isEmpty()) {
            erros.add(new ErroCampo("linhas", "O arquivo não tem movimentos."));
        } else if (linhas.size() > MAXIMO_LINHAS) {
            erros.add(new ErroCampo("linhas", "O extrato tem mais de " + MAXIMO_LINHAS + " linhas: importe um período menor."));
        } else {
            for (int i = 0; i < linhas.size(); i++) {
                LinhaNova l = linhas.get(i);
                if (l == null || l.data() == null) {
                    erros.add(new ErroCampo("linhas[" + i + "].data", "Linha " + (i + 1) + ": data inválida."));
                } else if (l.valor() == null || l.valor().signum() == 0) {
                    erros.add(new ErroCampo("linhas[" + i + "].valor", "Linha " + (i + 1) + ": valor inválido."));
                } else if (l.valor().stripTrailingZeros().scale() > 2) {
                    erros.add(new ErroCampo("linhas[" + i + "].valor",
                            "Linha " + (i + 1) + ": use no máximo duas casas decimais."));
                }
            }
        }
        ValidacaoException.lancarSeHouver(erros);
        List<LinhaNova> noPeriodo = linhas.stream()
                .filter(l -> l.data().isAfter(depoisDe) && !l.data().isAfter(ate))
                .map(ExtratoBancario::normalizar)
                .toList();
        if (noPeriodo.isEmpty()) {
            throw ValidacaoException.doCampo("linhas", "Nenhuma linha do arquivo está no período desta conciliação ("
                    + Dinheiro.data(depoisDe.plusDays(1)) + " a " + Dinheiro.data(ate) + ").");
        }
        return new Selecao(noPeriodo, linhas.size() - noPeriodo.size());
    }

    /**
     * Sugestões de par linha → lançamento: mesmo valor e no máximo {@link #TOLERANCIA_DIAS} dias de
     * distância, a menor distância primeiro (em empate, o lançamento mais antigo). Cada lançamento
     * entra em um par só.
     *
     * @param linhas      linhas do extrato ainda sem par
     * @param lancamentos lançamentos da sessão ainda sem linha
     */
    public static Map<Long, Long> sugerir(List<Movimento> linhas, List<Movimento> lancamentos) {
        Comparator<Movimento> ordem = Comparator.comparing(Movimento::data).thenComparingLong(Movimento::id);
        List<Movimento> ordenadas = linhas.stream().sorted(ordem).toList();
        List<Movimento> candidatos = lancamentos.stream().sorted(ordem).toList();
        Map<Long, Long> pares = new LinkedHashMap<>();
        Set<Long> usados = new HashSet<>();
        for (int dias = 0; dias <= TOLERANCIA_DIAS; dias++) {
            for (Movimento linha : ordenadas) {
                if (pares.containsKey(linha.id())) {
                    continue;
                }
                for (Movimento l : candidatos) {
                    if (!usados.contains(l.id()) && l.valor().compareTo(linha.valor()) == 0
                            && Math.abs(ChronoUnit.DAYS.between(linha.data(), l.data())) == dias) {
                        pares.put(linha.id(), l.id());
                        usados.add(l.id());
                        break;
                    }
                }
            }
        }
        return pares;
    }

    private static LinhaNova normalizar(LinhaNova l) {
        String descricao = l.descricao() == null ? "" : l.descricao().strip().replaceAll("\\s+", " ");
        if (descricao.isEmpty()) {
            descricao = "(sem descrição)";
        }
        if (descricao.length() > TAMANHO_DESCRICAO) {
            descricao = descricao.substring(0, TAMANHO_DESCRICAO);
        }
        String id = l.identificador() == null || l.identificador().isBlank() ? null : l.identificador().strip();
        if (id != null && id.length() > TAMANHO_DESCRICAO) {
            id = id.substring(0, TAMANHO_DESCRICAO);
        }
        return new LinhaNova(l.data(), descricao, l.valor(), id);
    }
}
