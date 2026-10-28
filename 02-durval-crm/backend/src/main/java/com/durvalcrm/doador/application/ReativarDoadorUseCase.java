package com.durvalcrm.doador.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reativação (US-DONOR-005): gera só a competência do mês da reativação; os meses inativos ficam
 * sem competência e as canceladas continuam canceladas.
 */
public class ReativarDoadorUseCase {

    private final DoadorRepository repositorio;
    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final RegistrarAuditoriaUseCase auditoria;

    public ReativarDoadorUseCase(DoadorRepository repositorio, GerenciarCompetenciasDoDoadorUseCase competencias,
            RegistrarAuditoriaUseCase auditoria) {
        this.repositorio = repositorio;
        this.competencias = competencias;
        this.auditoria = auditoria;
    }

    @Transactional
    public Doador reativar(long id, String motivo) {
        Doador doador = CarregarDoador.ou404(repositorio, id);
        doador.reativar(motivo);
        Doador salvo = repositorio.salvar(doador);
        competencias.gerarCompetenciaDoMesAtual(id);
        auditoria.registrar("DOADOR_REATIVADO", AuditoriaDoador.ENTIDADE, id, Map.of("motivo", motivo.trim()));
        return salvo;
    }
}
