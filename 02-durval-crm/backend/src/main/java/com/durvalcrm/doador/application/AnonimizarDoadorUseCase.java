package com.durvalcrm.doador.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.DecisaoPendencias;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.NotaDoadorRepository;
import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonimização LGPD (US-DONOR-008). Apaga dados pessoais e notas; contribuições, competências e
 * lançamentos continuam apontando para o registro. A auditoria guarda autor, data e motivo, nunca
 * os valores apagados.
 */
public class AnonimizarDoadorUseCase {

    private final DoadorRepository repositorio;
    private final NotaDoadorRepository notas;
    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public AnonimizarDoadorUseCase(DoadorRepository repositorio, NotaDoadorRepository notas,
            GerenciarCompetenciasDoDoadorUseCase competencias, RegistrarAuditoriaUseCase auditoria, Clock relogio) {
        this.repositorio = repositorio;
        this.notas = notas;
        this.competencias = competencias;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    @Transactional
    public Doador anonimizar(long id, AnonimizacaoCommand comando) {
        Doador doador = CarregarDoador.ou404(repositorio, id);
        boolean estavaAtivo = doador.anonimizar(comando.motivo(), comando.nomeConfirmacao(), comando.pendencias(),
                relogio.instant());
        Doador salvo = repositorio.salvar(doador);
        notas.excluirPorDoador(id);
        int canceladas = estavaAtivo && comando.pendencias() == DecisaoPendencias.CANCELAR
                ? competencias.cancelarPendentes(id) : 0;

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("motivo", comando.motivo().trim());
        detalhes.put("pendencias", estavaAtivo ? comando.pendencias().name() : null);
        detalhes.put("competenciasAfetadas", canceladas);
        auditoria.registrar("DOADOR_ANONIMIZADO", AuditoriaDoador.ENTIDADE, id, detalhes);
        return salvo;
    }
}
