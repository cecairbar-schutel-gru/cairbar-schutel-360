package com.durvalcrm.doador.adapter.in.rest;

import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.AnonimizacaoRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.AtualizacaoDoadorRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.CadastroRapidoRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.DadosDuplicidadeRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.InativacaoRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.NotaRequest;
import com.durvalcrm.doador.adapter.in.rest.DoadorRequests.ReativacaoRequest;
import com.durvalcrm.doador.application.AnonimizarDoadorUseCase;
import com.durvalcrm.doador.application.AtualizarDoadorUseCase;
import com.durvalcrm.doador.application.BuscarDoadoresUseCase;
import com.durvalcrm.doador.application.CadastrarDoadorRapidoUseCase;
import com.durvalcrm.doador.application.InativarDoadorUseCase;
import com.durvalcrm.doador.application.ListarAniversariantesUseCase;
import com.durvalcrm.doador.application.NotasDoadorUseCase;
import com.durvalcrm.doador.application.ObterDoadorUseCase;
import com.durvalcrm.doador.application.PossivelDuplicata;
import com.durvalcrm.doador.application.ReativarDoadorUseCase;
import com.durvalcrm.doador.application.ResultadoAniversariantes;
import com.durvalcrm.doador.application.ResumoDoador;
import com.durvalcrm.doador.application.VerificarDuplicatasUseCase;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API do módulo Doador. {@code @PreAuthorize} responde só "pode acessar o endpoint?"; as regras
 * de estado (ex.: anonimizado não muda) ficam no domínio.
 */
@RestController
@RequestMapping("/api/doadores")
class DoadorController {

    private static final String OPERACAO = "hasAnyRole('OPERADOR', 'ADMINISTRADOR')";
    private static final String ADMINISTRADOR = "hasRole('ADMINISTRADOR')";

    private final BuscarDoadoresUseCase buscar;
    private final VerificarDuplicatasUseCase duplicatas;
    private final ObterDoadorUseCase obter;
    private final CadastrarDoadorRapidoUseCase cadastrar;
    private final AtualizarDoadorUseCase atualizar;
    private final InativarDoadorUseCase inativar;
    private final ReativarDoadorUseCase reativar;
    private final AnonimizarDoadorUseCase anonimizar;
    private final NotasDoadorUseCase notas;
    private final ListarAniversariantesUseCase aniversariantes;

    DoadorController(BuscarDoadoresUseCase buscar, VerificarDuplicatasUseCase duplicatas, ObterDoadorUseCase obter,
            CadastrarDoadorRapidoUseCase cadastrar, AtualizarDoadorUseCase atualizar, InativarDoadorUseCase inativar,
            ReativarDoadorUseCase reativar, AnonimizarDoadorUseCase anonimizar, NotasDoadorUseCase notas,
            ListarAniversariantesUseCase aniversariantes) {
        this.buscar = buscar;
        this.duplicatas = duplicatas;
        this.obter = obter;
        this.cadastrar = cadastrar;
        this.atualizar = atualizar;
        this.inativar = inativar;
        this.reativar = reativar;
        this.anonimizar = anonimizar;
        this.notas = notas;
        this.aniversariantes = aniversariantes;
    }

    /** US-DONOR-001. */
    @GetMapping("/busca")
    @PreAuthorize(OPERACAO)
    List<ResumoDoador> buscar(@RequestParam(name = "q", defaultValue = "") String termo) {
        return buscar.buscar(termo);
    }

    /** US-DONOR-002. */
    @PostMapping("/duplicatas")
    @PreAuthorize(OPERACAO)
    List<PossivelDuplicata> duplicatas(@RequestBody DadosDuplicidadeRequest dados) {
        return duplicatas.verificar(dados.nome(), dados.telefone(), dados.email());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(OPERACAO)
    DoadorResponse cadastrar(@RequestBody CadastroRapidoRequest dados) {
        return DoadorResponse.de(cadastrar.cadastrar(dados.paraComando()));
    }

    /** US-DONOR-003. */
    @GetMapping("/{id}")
    @PreAuthorize(OPERACAO)
    DoadorResponse obter(@PathVariable long id) {
        return DoadorResponse.de(obter.obter(id));
    }

    @PutMapping("/{id}")
    @PreAuthorize(OPERACAO)
    DoadorResponse atualizar(@PathVariable long id, @RequestBody AtualizacaoDoadorRequest dados) {
        return DoadorResponse.de(atualizar.atualizar(id, dados.paraDados()));
    }

    /** US-DONOR-004. */
    @PostMapping("/{id}/inativacao")
    @PreAuthorize(ADMINISTRADOR)
    DoadorResponse inativar(@PathVariable long id, @RequestBody InativacaoRequest dados) {
        return DoadorResponse.de(inativar.inativar(id, dados.paraComando()));
    }

    /** US-DONOR-005. */
    @PostMapping("/{id}/reativacao")
    @PreAuthorize(ADMINISTRADOR)
    DoadorResponse reativar(@PathVariable long id, @RequestBody ReativacaoRequest dados) {
        return DoadorResponse.de(reativar.reativar(id, dados.motivo()));
    }

    /** US-DONOR-008. */
    @PostMapping("/{id}/anonimizacao")
    @PreAuthorize(ADMINISTRADOR)
    DoadorResponse anonimizar(@PathVariable long id, @RequestBody AnonimizacaoRequest dados) {
        return DoadorResponse.de(anonimizar.anonimizar(id, dados.paraComando()));
    }

    /** US-DONOR-012. */
    @GetMapping("/{id}/notas")
    @PreAuthorize(OPERACAO)
    List<NotaResponse> listarNotas(@PathVariable long id) {
        return notas.listar(id).stream().map(NotaResponse::de).toList();
    }

    @PostMapping("/{id}/notas")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize(OPERACAO)
    NotaResponse adicionarNota(@PathVariable long id, @RequestBody NotaRequest dados) {
        return NotaResponse.de(notas.adicionar(id, dados.texto()));
    }

    /** US-DONOR-007: perfis Operador e Administrador (matriz de permissões, US-AUTH-002). */
    @GetMapping("/aniversariantes")
    @PreAuthorize(OPERACAO)
    ResultadoAniversariantes aniversariantes(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate de,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ate) {
        return aniversariantes.listar(de, ate);
    }
}
