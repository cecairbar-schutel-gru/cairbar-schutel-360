package com.durvalcrm.relatorio.domain;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Cálculo do fluxo de caixa (US-REPORT-001) sobre um conjunto de contas, em centavos.
 *
 * <p>Cada lançamento move as contas escolhidas; esse movimento é explicado pelas categorias dele
 * (receitas entram, despesas saem) e o que sobra é transferência. As categorias de um lançamento
 * ficam com as linhas de conta do mesmo sinal, proporcionalmente: numa receita recebida em dinheiro
 * e PIX, cada conta leva a sua parte da receita; numa liquidação de cartão, a taxa sai de Cartão a
 * receber e o líquido é transferência dele para o banco. Transferências entre as contas escolhidas
 * aparecem nos dois sentidos. Assim, saldo inicial + entradas − saídas + transferências recebidas −
 * transferências enviadas = saldo final, sempre.
 */
public final class FluxoDeCaixa {

    private final Set<Long> contas;
    private final Set<String> receitas;
    private final Map<String, Long> entradas = new TreeMap<>();
    private final Map<String, Long> saidas = new TreeMap<>();
    private long transferenciasEntrada;
    private long transferenciasSaida;

    /** @param receitas códigos das subcategorias de receita; as demais são despesas. */
    public FluxoDeCaixa(Set<Long> contas, Set<String> receitas) {
        this.contas = Set.copyOf(contas);
        this.receitas = Set.copyOf(receitas);
    }

    /** Valores do movimento separados; também somados aos totais deste cálculo. */
    public Parcela somar(MovimentoRazao m) {
        long categoriasTotal = m.categorias().values().stream().mapToLong(Long::longValue).sum();
        int sinal = Long.signum(categoriasTotal);
        Map<Long, Long> mesmoSinal = new LinkedHashMap<>();
        m.contas().forEach((conta, valor) -> {
            if (sinal != 0 && Long.signum(valor) == sinal) {
                mesmoSinal.put(conta, valor);
            }
        });
        Map<Long, Long> explicado = Rateio.proporcional(categoriasTotal, mesmoSinal);

        long explicadoNasContas = 0;
        long tEntrada = 0;
        long tSaida = 0;
        for (Map.Entry<Long, Long> linha : m.contas().entrySet()) {
            if (!contas.contains(linha.getKey())) {
                continue;
            }
            long parteCategorias = explicado.getOrDefault(linha.getKey(), 0L);
            explicadoNasContas += parteCategorias;
            long transferencia = linha.getValue() - parteCategorias;
            if (transferencia > 0) {
                tEntrada += transferencia;
            } else {
                tSaida -= transferencia;
            }
        }

        Map<String, Long> porCategoria = explicadoNasContas == 0 ? Map.of()
                : Rateio.proporcional(explicadoNasContas, new LinkedHashMap<>(m.categorias()));
        long entrou = 0;
        long saiu = 0;
        for (Map.Entry<String, Long> c : porCategoria.entrySet()) {
            if (receitas.contains(c.getKey())) {
                entradas.merge(c.getKey(), c.getValue(), Long::sum);
                entrou += c.getValue();
            } else {
                saidas.merge(c.getKey(), -c.getValue(), Long::sum);
                saiu -= c.getValue();
            }
        }
        transferenciasEntrada += tEntrada;
        transferenciasSaida += tSaida;
        return new Parcela(entrou, saiu, tEntrada, tSaida);
    }

    public Parcela somarTodos(List<MovimentoRazao> movimentos) {
        Parcela total = Parcela.ZERO;
        for (MovimentoRazao m : movimentos) {
            total = total.mais(somar(m));
        }
        return total;
    }

    /** Entradas por subcategoria de receita (estornos já descontados). */
    public Map<String, Long> entradas() {
        return Map.copyOf(entradas);
    }

    /** Saídas por subcategoria de despesa, positivas. */
    public Map<String, Long> saidas() {
        return Map.copyOf(saidas);
    }

    public long transferenciasEntrada() {
        return transferenciasEntrada;
    }

    public long transferenciasSaida() {
        return transferenciasSaida;
    }

    /** Valores em centavos; {@code saidas} e {@code transferenciasSaida} positivos. */
    public record Parcela(long entradas, long saidas, long transferenciasEntrada, long transferenciasSaida) {

        public static final Parcela ZERO = new Parcela(0, 0, 0, 0);

        public long liquido() {
            return entradas - saidas + transferenciasEntrada - transferenciasSaida;
        }

        public Parcela mais(Parcela p) {
            return new Parcela(entradas + p.entradas, saidas + p.saidas, transferenciasEntrada + p.transferenciasEntrada,
                    transferenciasSaida + p.transferenciasSaida);
        }
    }
}
