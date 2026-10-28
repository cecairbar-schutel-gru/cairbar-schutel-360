package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.ValorConsentimento;
import java.util.List;

/**
 * @param duplicatasDescartadas doadores apontados como possível duplicata e marcados pelo Operador
 *                              como "é outra pessoa"; cada decisão vai para a auditoria
 */
public record CadastroRapidoCommand(String nome, String telefone, String email,
        ValorConsentimento consentimentoWhatsapp, ValorConsentimento consentimentoEmail,
        List<Long> duplicatasDescartadas) {

    public CadastroRapidoCommand {
        consentimentoWhatsapp = consentimentoWhatsapp == null ? ValorConsentimento.NAO_INFORMADO : consentimentoWhatsapp;
        consentimentoEmail = consentimentoEmail == null ? ValorConsentimento.NAO_INFORMADO : consentimentoEmail;
        duplicatasDescartadas = duplicatasDescartadas == null ? List.of() : List.copyOf(duplicatasDescartadas);
    }
}
