package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.ValorConsentimento;
import java.time.LocalDate;

/** Aniversário de um doador ativo dentro do período consultado (US-DONOR-007). */
public record Aniversariante(long doadorId, String nome, LocalDate dataAniversario, int idadeACompletar,
        ValorConsentimento consentimentoWhatsapp, ValorConsentimento consentimentoEmail, String telefonePrincipal,
        String emailPrincipal) {
}
