package com.durvalcrm.doador.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.DecisaoPendencias;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Inativação (US-DONOR-004). Com "Cancelar pendentes", todas as pendentes (inclusive a do mês já
 * gerada) passam a Canceladas mantendo o valor original; pagas nunca mudam.
 */
public class InativarDoadorUseCase {

    private final DoadorRepository repositorio;
    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public InativarDoadorUseCase(DoadorRepository repositorio, GerenciarCompetenciasDoDoadorUseCase competencias,
            RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        this.repositorio = repositorio;
        this.competencias = competencias;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    @Transactional
    public Doador inativar(long id, InativacaoCommand comando) {
        Doador doador = CarregarDoador.ou404(repositorio, id);
        doador.inativar(comando.motivo(), comando.pendencias(), relogio.instant());
        Doador salvo = repositorio.salvar(doador);
        long pendentes = competencias.contarPendentes(List.of(id)).getOrDefault(id, 0L);
        int canceladas = comando.pendencias() == DecisaoPendencias.CANCELAR ? competencias.cancelarPendentes(id) : 0;

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("motivo", salvo.getMotivoInativacao());
        detalhes.put("pendencias", comando.pendencias().name());
        detalhes.put("competenciasPendentes", pendentes);
        detalhes.put("competenciasAfetadas", canceladas);
        auditoria.registrar("DOADOR_INATIVADO", AuditoriaDoador.ENTIDADE, id, detalhes);
        return salvo;
    }
}
