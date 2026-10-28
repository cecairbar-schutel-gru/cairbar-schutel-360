package com.durvalcrm.doador.adapter.out.cep;

import com.durvalcrm.doador.application.CepPort;
import com.durvalcrm.doador.domain.Endereco;
import java.time.Duration;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** Consulta o ViaCEP; falhas e CEPs inexistentes viram vazio e o usuário preenche à mão. */
@Component
class ViaCepAdapter implements CepPort {

    private static final Logger LOG = LoggerFactory.getLogger(ViaCepAdapter.class);

    private final RestClient cliente;

    ViaCepAdapter(RestClient.Builder builder, @Value("${durvalcrm.cep.url:https://viacep.com.br/ws}") String url) {
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(Duration.ofSeconds(2));
        fabrica.setReadTimeout(Duration.ofSeconds(3));
        this.cliente = builder.baseUrl(url).requestFactory(fabrica).build();
    }

    record RespostaViaCep(String cep, String logradouro, String complemento, String bairro, String localidade,
            String uf, Boolean erro) {
    }

    @Override
    public Optional<Endereco> consultar(String cep) {
        try {
            RespostaViaCep r = cliente.get().uri("/{cep}/json/", cep).retrieve().body(RespostaViaCep.class);
            if (r == null || Boolean.TRUE.equals(r.erro())) {
                return Optional.empty();
            }
            return Optional.of(new Endereco(cep, r.logradouro(), "", "", r.bairro(), r.localidade(), r.uf()));
        } catch (RestClientException e) {
            LOG.warn("Consulta de CEP indisponível: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
