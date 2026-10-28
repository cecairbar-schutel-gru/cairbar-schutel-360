package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Endereco;
import com.durvalcrm.shared.domain.Textos;
import java.util.Optional;

/** Preenchimento do endereço a partir do CEP (US-DONOR-003). */
public class ConsultarCepUseCase {

    private final CepPort cep;

    public ConsultarCepUseCase(CepPort cep) {
        this.cep = cep;
    }

    public Optional<Endereco> consultar(String valor) {
        return Endereco.cepValido(valor) ? cep.consultar(Textos.apenasDigitos(valor))
                : Optional.empty();
    }
}
