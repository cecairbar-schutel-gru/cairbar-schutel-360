package com.durvalcrm.doador.adapter.in.rest;

import com.durvalcrm.doador.adapter.in.rest.DoadorResponse.EmailDto;
import com.durvalcrm.doador.adapter.in.rest.DoadorResponse.EnderecoDto;
import com.durvalcrm.doador.adapter.in.rest.DoadorResponse.TelefoneDto;
import com.durvalcrm.doador.application.AnonimizacaoCommand;
import com.durvalcrm.doador.application.CadastroRapidoCommand;
import com.durvalcrm.doador.application.InativacaoCommand;
import com.durvalcrm.doador.domain.DadosCadastrais;
import com.durvalcrm.doador.domain.DecisaoPendencias;
import com.durvalcrm.doador.domain.Email;
import com.durvalcrm.doador.domain.Telefone;
import com.durvalcrm.doador.domain.ValorConsentimento;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/** DTOs HTTP de entrada do módulo Doador; as regras ficam no domínio, aqui só a conversão. */
final class DoadorRequests {

    private DoadorRequests() {
    }

    record DadosDuplicidadeRequest(String nome, String telefone, String email) {
    }

    record CadastroRapidoRequest(String nome, String telefone, String email, ValorConsentimento consentimentoWhatsapp,
            ValorConsentimento consentimentoEmail, List<Long> duplicatasDescartadas) {

        CadastroRapidoCommand paraComando() {
            return new CadastroRapidoCommand(nome, telefone, email, consentimentoWhatsapp, consentimentoEmail,
                    duplicatasDescartadas);
        }
    }

    record AtualizacaoDoadorRequest(String nome, String cpf, String dataNascimento, List<TelefoneDto> telefones,
            List<EmailDto> emails, EnderecoDto endereco, ValorConsentimento consentimentoWhatsapp,
            ValorConsentimento consentimentoEmail) {

        DadosCadastrais paraDados() {
            return new DadosCadastrais(nome, cpf, data(dataNascimento),
                    telefones == null ? List.of()
                            : telefones.stream().map(t -> new Telefone(t.tipo(), t.numero(), t.principal())).toList(),
                    emails == null ? List.of() : emails.stream().map(e -> new Email(e.endereco(), e.principal())).toList(),
                    endereco == null ? null : endereco.paraDominio(),
                    consentimentoWhatsapp == null ? ValorConsentimento.NAO_INFORMADO : consentimentoWhatsapp,
                    consentimentoEmail == null ? ValorConsentimento.NAO_INFORMADO : consentimentoEmail);
        }

        private static LocalDate data(String valor) {
            if (Textos.vazio(valor)) {
                return null;
            }
            try {
                return LocalDate.parse(valor.trim());
            } catch (DateTimeParseException e) {
                throw ValidacaoException.doCampo("dataNascimento", "Data de nascimento inválida.");
            }
        }
    }

    record InativacaoRequest(String motivo, DecisaoPendencias pendencias) {

        InativacaoCommand paraComando() {
            return new InativacaoCommand(motivo, pendencias);
        }
    }

    record ReativacaoRequest(String motivo) {
    }

    record AnonimizacaoRequest(String motivo, String nomeConfirmacao, DecisaoPendencias pendencias) {

        AnonimizacaoCommand paraComando() {
            return new AnonimizacaoCommand(motivo, nomeConfirmacao, pendencias);
        }
    }

    record NotaRequest(String texto) {
    }
}
