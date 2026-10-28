package com.durvalcrm.doador.adapter.in.rest;

import com.durvalcrm.doador.adapter.in.rest.DoadorResponse.EnderecoDto;
import com.durvalcrm.doador.application.ConsultarCepUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class EnderecoController {

    private final ConsultarCepUseCase cep;

    EnderecoController(ConsultarCepUseCase cep) {
        this.cep = cep;
    }

    /** CEP não encontrado responde 204: o formulário segue para preenchimento manual. */
    @GetMapping("/api/enderecos/cep/{cep}")
    @PreAuthorize("hasAnyRole('OPERADOR', 'ADMINISTRADOR')")
    ResponseEntity<EnderecoDto> consultar(@PathVariable String cep) {
        return this.cep.consultar(cep).map(e -> ResponseEntity.ok(EnderecoDto.de(e)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
