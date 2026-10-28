package com.durvalcrm.administracao.adapter.in.rest;

import com.durvalcrm.administracao.application.ConsultarAuditoriaUseCase;
import com.durvalcrm.administracao.application.ConsultarAuditoriaUseCase.Opcoes;
import com.durvalcrm.administracao.application.ConsultarAuditoriaUseCase.PaginaAuditoria;
import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.FiltroAuditoria;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Log de auditoria (US-ADMIN-009): pesquisa do Administrador, histórico de cada entidade nas páginas
 * de detalhe e registro de entrada e saída. Não há operação de alteração nem de exclusão.
 */
@RestController
@RequestMapping("/api/auditoria")
class AuditoriaController {

    private static final Set<String> EVENTOS_SESSAO = Set.of("LOGIN", "LOGOUT");

    private final ConsultarAuditoriaUseCase consulta;
    private final RegistrarAuditoriaUseCase registro;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    AuditoriaController(ConsultarAuditoriaUseCase consulta, RegistrarAuditoriaUseCase registro, CurrentUserPort usuario,
            Clock relogio) {
        this.consulta = consulta;
        this.registro = registro;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    /** Datas no fuso da organização; {@code ate} inclui o dia inteiro. */
    @GetMapping
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    PaginaAuditoria pesquisar(@RequestParam(required = false) String de, @RequestParam(required = false) String ate,
            @RequestParam(required = false) String usuario, @RequestParam(required = false) String acao,
            @RequestParam(required = false) String entidade, @RequestParam(required = false) String entidadeId,
            @RequestParam(defaultValue = "1") int pagina) {
        LocalDate inicio = data("de", de);
        LocalDate fim = data("ate", ate);
        return consulta.pesquisar(new FiltroAuditoria(
                inicio == null ? null : inicio.atStartOfDay(relogio.getZone()).toInstant(),
                fim == null ? null : fim.plusDays(1).atStartOfDay(relogio.getZone()).toInstant(),
                usuario, acao, entidade, entidadeId), pagina);
    }

    @GetMapping("/opcoes")
    @PreAuthorize("hasRole('ADMINISTRADOR')")
    Opcoes opcoes() {
        return consulta.opcoes();
    }

    /** Aba "Histórico" das páginas de detalhe; a própria página já restringe quem a vê. */
    @GetMapping("/entidades/{entidade}/{id}")
    @PreAuthorize("hasAnyRole('OPERADOR', 'VENDEDOR', 'TESOUREIRO', 'ADMINISTRADOR')")
    List<EventoAuditoria> historico(@PathVariable String entidade, @PathVariable String id) {
        return consulta.historico(entidade, id);
    }

    /** Entrada e saída registradas pelo frontend (o login falho fica nos eventos do Keycloak). */
    @PostMapping("/sessao")
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<Void> sessao(@RequestBody SessaoRequest r) {
        if (r == null || r.evento() == null || !EVENTOS_SESSAO.contains(r.evento())) {
            throw ValidacaoException.doCampo("evento", "Use LOGIN ou LOGOUT.");
        }
        registro.registrar(r.evento(), "Sessao", usuario.getSubject(), Map.of());
        return ResponseEntity.noContent().build();
    }

    private static LocalDate data(String campo, String valor) {
        try {
            return valor == null || valor.isBlank() ? null : LocalDate.parse(valor);
        } catch (DateTimeParseException e) {
            throw ValidacaoException.doCampo(campo, "Informe a data no formato AAAA-MM-DD.");
        }
    }

    record SessaoRequest(String evento) {
    }
}
