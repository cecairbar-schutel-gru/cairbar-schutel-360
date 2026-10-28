package com.durvalcrm.contribuicao.application;

import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import java.time.Clock;
import java.time.YearMonth;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/** Operações de competência acionadas pelo ciclo de vida do doador (US-CONTRIB-001, US-DONOR-004/005). */
public class GerenciarCompetenciasDoDoadorUseCase {

    private final CompetenciaRepository repositorio;
    private final MensalidadeVigentePort mensalidade;
    private final Clock relogio;

    public GerenciarCompetenciasDoDoadorUseCase(CompetenciaRepository repositorio, MensalidadeVigentePort mensalidade,
            Clock relogio) {
        this.repositorio = repositorio;
        this.mensalidade = mensalidade;
        this.relogio = relogio;
    }

    /** Gera a competência do mês corrente, se ainda não existir. */
    @Transactional
    public void gerarCompetenciaDoMesAtual(long doadorId) {
        YearMonth mes = YearMonth.now(relogio);
        if (!repositorio.existe(doadorId, mes)) {
            repositorio.salvar(Competencia.gerar(doadorId, mes, mensalidade.valorPara(mes)));
        }
    }

    /**
     * Competências pendentes de um doador importado (US-ADMIN-012), cada uma com o valor do próprio mês;
     * as que já existem ficam como estão.
     */
    @Transactional
    public void gerarPendentesImportadas(long doadorId, Collection<YearMonth> meses) {
        for (YearMonth mes : meses) {
            if (!repositorio.existe(doadorId, mes)) {
                repositorio.salvar(Competencia.gerar(doadorId, mes, mensalidade.valorPara(mes)));
            }
        }
    }

    /** Cancela todas as pendentes, mantendo o valor original; devolve quantas foram canceladas. */
    @Transactional
    public int cancelarPendentes(long doadorId) {
        List<Competencia> pendentes = repositorio.listarPendentes(doadorId);
        pendentes.forEach(Competencia::cancelar);
        repositorio.salvarTodas(pendentes);
        return pendentes.size();
    }

    @Transactional(readOnly = true)
    public List<Competencia> listarPorDoador(long doadorId) {
        return repositorio.listarPorDoador(doadorId);
    }

    @Transactional(readOnly = true)
    public List<Competencia> listarPendentes(long doadorId) {
        return repositorio.listarPendentes(doadorId);
    }

    @Transactional(readOnly = true)
    public Map<Long, Long> contarPendentes(Collection<Long> doadorIds) {
        return doadorIds.isEmpty() ? Map.of() : repositorio.contarPendentesPorDoador(doadorIds);
    }
}
