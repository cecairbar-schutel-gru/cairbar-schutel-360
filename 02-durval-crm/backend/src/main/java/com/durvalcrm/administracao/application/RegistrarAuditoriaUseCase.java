package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.shared.application.ContextoRequisicaoPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Porta de entrada usada pelos demais módulos para registrar eventos de auditoria (US-ADMIN-009),
 * com o perfil em uso e o IP da requisição.
 */
public class RegistrarAuditoriaUseCase {

    public static final String SISTEMA = "sistema";

    private final EventoAuditoriaRepository repositorio;
    private final CurrentUserPort usuario;
    private final ContextoRequisicaoPort requisicao;
    private final Clock relogio;

    public RegistrarAuditoriaUseCase(EventoAuditoriaRepository repositorio, CurrentUserPort usuario,
            ContextoRequisicaoPort requisicao, Clock relogio) {
        this.repositorio = repositorio;
        this.usuario = usuario;
        this.requisicao = requisicao;
        this.relogio = relogio;
    }

    public void registrar(String acao, String entidade, Object entidadeId, Map<String, Object> detalhes) {
        repositorio.registrar(new EventoAuditoria(null, relogio.instant(), usuario.getSubject(), usuario.getNome(),
                requisicao.perfil(), requisicao.ip(), acao, entidade, String.valueOf(entidadeId), detalhes));
    }

    /** Alteração de configuração: valores anteriores e novos e, se houver, o motivo. */
    public void registrarAlteracao(String acao, String entidade, Object entidadeId, Object antes, Object depois,
            String motivo) {
        Map<String, Object> detalhes = new LinkedHashMap<>();
        if (antes != null) {
            detalhes.put("antes", antes);
        }
        if (depois != null) {
            detalhes.put("depois", depois);
        }
        if (motivo != null && !motivo.isBlank()) {
            detalhes.put("motivo", motivo);
        }
        registrar(acao, entidade, entidadeId, detalhes);
    }

    /** Para rotinas agendadas, que não têm usuário autenticado. */
    public void registrarComoSistema(String acao, String entidade, Object entidadeId, Map<String, Object> detalhes) {
        repositorio.registrar(new EventoAuditoria(null, relogio.instant(), SISTEMA, "Sistema", null, null, acao,
                entidade, String.valueOf(entidadeId), detalhes));
    }
}
