package com.durvalcrm.doador.adapter.in.rest;

import com.durvalcrm.doador.domain.Consentimento;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.Endereco;
import com.durvalcrm.doador.domain.StatusDoador;
import com.durvalcrm.doador.domain.TipoTelefone;
import com.durvalcrm.doador.domain.ValorConsentimento;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DoadorResponse(
        long id,
        String nome,
        String cpf,
        LocalDate dataNascimento,
        StatusDoador status,
        List<TelefoneDto> telefones,
        List<EmailDto> emails,
        EnderecoDto endereco,
        ConsentimentoDto consentimentoWhatsapp,
        ConsentimentoDto consentimentoEmail,
        Instant criadoEm,
        Instant inativadoEm,
        String motivoInativacao) {

    public record TelefoneDto(TipoTelefone tipo, String numero, boolean principal) {
    }

    public record EmailDto(String endereco, boolean principal) {
    }

    public record EnderecoDto(String cep, String logradouro, String numero, String complemento, String bairro,
            String cidade, String uf) {

        static EnderecoDto de(Endereco e) {
            return e == null ? null
                    : new EnderecoDto(e.cep(), e.logradouro(), e.numero(), e.complemento(), e.bairro(), e.cidade(), e.uf());
        }

        Endereco paraDominio() {
            return new Endereco(cep, logradouro, numero, complemento, bairro, cidade, uf);
        }
    }

    public record ConsentimentoDto(ValorConsentimento valor, Instant registradoEm, String registradoPor) {

        static ConsentimentoDto de(Consentimento c) {
            return new ConsentimentoDto(c.valor(), c.registradoEm(), c.registradoPor());
        }
    }

    static DoadorResponse de(Doador d) {
        return new DoadorResponse(d.getId(), d.getNome(), d.getCpf().map(c -> c.digitos()).orElse(null),
                d.getDataNascimento(), d.getStatus(),
                d.getTelefones().stream().map(t -> new TelefoneDto(t.tipo(), t.numero(), t.principal())).toList(),
                d.getEmails().stream().map(e -> new EmailDto(e.endereco(), e.principal())).toList(),
                EnderecoDto.de(d.getEndereco()), ConsentimentoDto.de(d.getConsentimentoWhatsapp()),
                ConsentimentoDto.de(d.getConsentimentoEmail()), d.getCriadoEm(), d.getInativadoEm(),
                d.getMotivoInativacao());
    }
}
