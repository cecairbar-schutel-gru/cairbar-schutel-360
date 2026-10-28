package com.durvalcrm.doador.infrastructure;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.application.AnonimizarDoadorUseCase;
import com.durvalcrm.doador.application.AtualizarDoadorUseCase;
import com.durvalcrm.doador.application.BuscarDoadoresUseCase;
import com.durvalcrm.doador.application.CadastrarDoadorRapidoUseCase;
import com.durvalcrm.doador.application.CepPort;
import com.durvalcrm.doador.application.ConsultarCepUseCase;
import com.durvalcrm.doador.application.InativarDoadorUseCase;
import com.durvalcrm.doador.application.ListarAniversariantesUseCase;
import com.durvalcrm.doador.application.NotasDoadorUseCase;
import com.durvalcrm.doador.application.ObterDoadorUseCase;
import com.durvalcrm.doador.application.ReativarDoadorUseCase;
import com.durvalcrm.doador.application.VerificarDuplicatasUseCase;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.NotaDoadorRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Monta os casos de uso do módulo Doador sem anotações de framework na camada de aplicação. */
@Configuration
public class DoadorConfiguration {

    @Bean
    BuscarDoadoresUseCase buscarDoadoresUseCase(DoadorRepository r, GerenciarCompetenciasDoDoadorUseCase c) {
        return new BuscarDoadoresUseCase(r, c);
    }

    @Bean
    VerificarDuplicatasUseCase verificarDuplicatasUseCase(DoadorRepository r, GerenciarCompetenciasDoDoadorUseCase c) {
        return new VerificarDuplicatasUseCase(r, c);
    }

    @Bean
    ObterDoadorUseCase obterDoadorUseCase(DoadorRepository r) {
        return new ObterDoadorUseCase(r);
    }

    @Bean
    CadastrarDoadorRapidoUseCase cadastrarDoadorRapidoUseCase(DoadorRepository r,
            GerenciarCompetenciasDoDoadorUseCase c, RegistrarAuditoriaUseCase a, CurrentUserPort u, Clock relogio) {
        return new CadastrarDoadorRapidoUseCase(r, c, a, u, relogio);
    }

    @Bean
    AtualizarDoadorUseCase atualizarDoadorUseCase(DoadorRepository r, RegistrarAuditoriaUseCase a, CurrentUserPort u,
            Clock relogio) {
        return new AtualizarDoadorUseCase(r, a, u, relogio);
    }

    @Bean
    InativarDoadorUseCase inativarDoadorUseCase(DoadorRepository r, GerenciarCompetenciasDoDoadorUseCase c,
            RegistrarAuditoriaUseCase a, Clock relogio) {
        return new InativarDoadorUseCase(r, c, a, relogio);
    }

    @Bean
    ReativarDoadorUseCase reativarDoadorUseCase(DoadorRepository r, GerenciarCompetenciasDoDoadorUseCase c,
            RegistrarAuditoriaUseCase a) {
        return new ReativarDoadorUseCase(r, c, a);
    }

    @Bean
    AnonimizarDoadorUseCase anonimizarDoadorUseCase(DoadorRepository r, NotaDoadorRepository n,
            GerenciarCompetenciasDoDoadorUseCase c, RegistrarAuditoriaUseCase a, Clock relogio) {
        return new AnonimizarDoadorUseCase(r, n, c, a, relogio);
    }

    @Bean
    NotasDoadorUseCase notasDoadorUseCase(DoadorRepository r, NotaDoadorRepository n, CurrentUserPort u,
            Clock relogio) {
        return new NotasDoadorUseCase(r, n, u, relogio);
    }

    @Bean
    ListarAniversariantesUseCase listarAniversariantesUseCase(DoadorRepository r) {
        return new ListarAniversariantesUseCase(r);
    }

    @Bean
    ConsultarCepUseCase consultarCepUseCase(CepPort cep) {
        return new ConsultarCepUseCase(cep);
    }
}
