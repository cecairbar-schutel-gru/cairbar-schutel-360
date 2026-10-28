package com.durvalcrm.relatorio.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Divide um valor em centavos proporcionalmente a pesos, pelo método dos maiores restos: a soma das
 * partes é sempre exatamente o total.
 */
public final class Rateio {

    private Rateio() {
    }

    /** Pesos com soma zero (ou sem pesos) não recebem nada. */
    public static <K> Map<K, Long> proporcional(long total, Map<K, Long> pesos) {
        Map<K, Long> partes = new LinkedHashMap<>();
        long somaPesos = pesos.values().stream().mapToLong(Long::longValue).sum();
        if (somaPesos == 0) {
            pesos.keySet().forEach(k -> partes.put(k, 0L));
            return partes;
        }
        record Resto<K>(K chave, double fracao) {
        }
        List<Resto<K>> restos = new ArrayList<>();
        long distribuido = 0;
        for (Map.Entry<K, Long> p : pesos.entrySet()) {
            double exato = (double) total * p.getValue() / somaPesos;
            long parte = (long) (exato < 0 ? Math.ceil(exato) : Math.floor(exato));
            partes.put(p.getKey(), parte);
            distribuido += parte;
            restos.add(new Resto<>(p.getKey(), Math.abs(exato - parte)));
        }
        long sobra = total - distribuido;
        long passo = Long.signum(sobra);
        restos.sort(Comparator.comparingDouble((Resto<K> r) -> r.fracao()).reversed());
        for (int i = 0; sobra != 0; i = (i + 1) % restos.size()) {
            K chave = restos.get(i).chave();
            partes.put(chave, partes.get(chave) + passo);
            sobra -= passo;
        }
        return partes;
    }
}
