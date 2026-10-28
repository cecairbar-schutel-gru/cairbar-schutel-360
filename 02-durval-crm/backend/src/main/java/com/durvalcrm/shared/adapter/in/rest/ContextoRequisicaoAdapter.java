package com.durvalcrm.shared.adapter.in.rest;

import com.durvalcrm.shared.application.ContextoRequisicaoPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Perfil em uso (cabeçalho {@code X-Perfil-Ativo}, aceito só se o usuário tiver o papel) e IP de
 * origem (primeiro endereço de {@code X-Forwarded-For}, quando o Tomcat está atrás de um proxy).
 */
@Component
class ContextoRequisicaoAdapter implements ContextoRequisicaoPort {

    static final String CABECALHO_PERFIL = "X-Perfil-Ativo";
    private static final Set<String> PERFIS = Set.of("operador", "vendedor", "tesoureiro", "administrador");

    private final CurrentUserPort usuario;

    ContextoRequisicaoAdapter(CurrentUserPort usuario) {
        this.usuario = usuario;
    }

    @Override
    public String perfil() {
        HttpServletRequest req = requisicao();
        String perfil = req == null ? null : req.getHeader(CABECALHO_PERFIL);
        if (perfil == null) {
            return null;
        }
        perfil = perfil.trim().toLowerCase(Locale.ROOT);
        return PERFIS.contains(perfil) && usuario.hasRole(perfil) ? perfil : null;
    }

    @Override
    public String ip() {
        HttpServletRequest req = requisicao();
        if (req == null) {
            return null;
        }
        String encaminhado = req.getHeader("X-Forwarded-For");
        String ip = encaminhado != null && !encaminhado.isBlank() ? encaminhado.split(",")[0].trim() : req.getRemoteAddr();
        return ip == null || ip.length() > 45 ? null : ip;
    }

    private static HttpServletRequest requisicao() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes a ? a.getRequest() : null;
    }
}
