package com.durvalcrm.doador.application;

import com.durvalcrm.doador.domain.Endereco;
import java.util.Optional;

/** Consulta de logradouro por CEP; indisponibilidade do serviço resulta em vazio. */
public interface CepPort {

    Optional<Endereco> consultar(String cep);
}
