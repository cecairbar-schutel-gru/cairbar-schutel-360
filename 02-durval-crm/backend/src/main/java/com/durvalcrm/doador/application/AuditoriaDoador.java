package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Doador;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** Montagem dos detalhes de auditoria do doador. */
final class AuditoriaDoador {

    static final String ENTIDADE = "DOADOR";

    private AuditoriaDoador() {
    }

    /** Campos visíveis do perfil, em forma serializável. */
    static Map<String, Object> instantaneo(Doador d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", d.getNome());
        m.put("cpf", d.getCpf().map(c -> c.digitos()).orElse(null));
        m.put("dataNascimento", d.getDataNascimento() == null ? null : d.getDataNascimento().toString());
        m.put("telefones", d.getTelefones().stream()
                .map(t -> t.tipo() + ":" + t.numero() + (t.principal() ? "*" : "")).toList());
        m.put("emails", d.getEmails().stream().map(e -> e.endereco() + (e.principal() ? "*" : "")).toList());
        m.put("endereco", d.getEndereco() == null ? null : d.getEndereco().toString());
        m.put("consentimentoWhatsapp", d.getConsentimentoWhatsapp().valor().name());
        m.put("consentimentoEmail", d.getConsentimentoEmail().valor().name());
        return m;
    }

    /** Somente os campos alterados, com valor anterior e novo (US-ADMIN-009). */
    static Map<String, Object> diferencas(Map<String, Object> anterior, Map<String, Object> novo) {
        Map<String, Object> alteracoes = new LinkedHashMap<>();
        for (String campo : novo.keySet()) {
            if (!Objects.equals(anterior.get(campo), novo.get(campo))) {
                Map<String, Object> par = new LinkedHashMap<>();
                par.put("anterior", anterior.get(campo));
                par.put("novo", novo.get(campo));
                alteracoes.put(campo, par);
            }
        }
        return alteracoes;
    }
}
