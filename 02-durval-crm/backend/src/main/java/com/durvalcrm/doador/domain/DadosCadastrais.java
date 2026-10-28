package com.durvalcrm.doador.domain;

import java.time.LocalDate;
import java.util.List;

/** Dados editáveis do perfil completo (US-DONOR-003). Sem gênero, RG ou profissão (minimização LGPD). */
public record DadosCadastrais(
        String nome,
        String cpf,
        LocalDate dataNascimento,
        List<Telefone> telefones,
        List<Email> emails,
        Endereco endereco,
        ValorConsentimento consentimentoWhatsapp,
        ValorConsentimento consentimentoEmail) {

    public DadosCadastrais {
        telefones = telefones == null ? List.of() : List.copyOf(telefones);
        emails = emails == null ? List.of() : List.copyOf(emails);
    }
}
