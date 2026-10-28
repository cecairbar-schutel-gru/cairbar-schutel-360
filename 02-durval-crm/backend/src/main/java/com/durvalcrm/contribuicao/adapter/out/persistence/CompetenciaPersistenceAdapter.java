package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
class CompetenciaPersistenceAdapter implements CompetenciaRepository {

    private final SpringDataCompetenciaRepository repositorio;

    CompetenciaPersistenceAdapter(SpringDataCompetenciaRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Override
    public void salvar(Competencia c) {
        repositorio.save(paraJpa(c));
    }

    @Override
    public void salvarTodas(Collection<Competencia> competencias) {
        repositorio.saveAll(competencias.stream().map(CompetenciaPersistenceAdapter::paraJpa).toList());
    }

    @Override
    public boolean existe(long doadorId, YearMonth mes) {
        return repositorio.existsByDoadorIdAndMes(doadorId, mes.atDay(1));
    }

    @Override
    public Optional<Competencia> buscar(long doadorId, YearMonth mes) {
        return repositorio.findByDoadorIdAndMes(doadorId, mes.atDay(1)).map(CompetenciaPersistenceAdapter::paraDominio);
    }

    @Override
    public List<Competencia> listarPorDoador(long doadorId) {
        return repositorio.findByDoadorIdOrderByMesAsc(doadorId).stream().map(CompetenciaPersistenceAdapter::paraDominio).toList();
    }

    @Override
    public List<Competencia> listarPendentes(long doadorId) {
        return repositorio.findByDoadorIdAndStatusOrderByMesAsc(doadorId, StatusCompetencia.PENDENTE).stream()
                .map(CompetenciaPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public List<Competencia> listarPorContribuicao(long contribuicaoId) {
        return repositorio.findByContribuicaoIdOrderByMesAsc(contribuicaoId).stream()
                .map(CompetenciaPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public Map<Long, Long> contarPendentesPorDoador(Collection<Long> doadorIds) {
        return repositorio.contarPorDoador(doadorIds, StatusCompetencia.PENDENTE).stream()
                .collect(Collectors.toMap(l -> (Long) l[0], l -> (Long) l[1]));
    }

    @Override
    public Set<Long> doadoresComCompetencia(YearMonth mes) {
        return new HashSet<>(repositorio.doadoresDoMes(mes.atDay(1)));
    }

    @Override
    public boolean marcarComoPaga(long competenciaId, long contribuicaoId, LocalDate dataPagamento, String numeroRecibo) {
        return repositorio.pagarSePendente(competenciaId, contribuicaoId, dataPagamento, numeroRecibo) == 1;
    }

    /** A unicidade (doador, mês) do banco resolve dois pagamentos antecipados simultâneos. */
    @Override
    public boolean inserirPaga(Competencia competencia) {
        try {
            repositorio.saveAndFlush(paraJpa(competencia));
            return true;
        } catch (DataIntegrityViolationException e) {
            return false;
        }
    }

    @Override
    public void reabrir(long competenciaId) {
        repositorio.reabrir(competenciaId);
    }

    @Override
    public void excluir(long competenciaId) {
        repositorio.deleteById(competenciaId);
        repositorio.flush();
    }

    private static CompetenciaJpaEntity paraJpa(Competencia c) {
        return new CompetenciaJpaEntity(c.getId(), c.getDoadorId(), c.getMes().atDay(1), c.getValor(), c.getStatus(),
                c.getDataPagamento(), c.getNumeroRecibo(), c.getContribuicaoId(), c.isCriadaNoPagamento());
    }

    private static Competencia paraDominio(CompetenciaJpaEntity j) {
        return Competencia.reconstituir(j.getId(), j.getDoadorId(), YearMonth.from(j.getMes()), j.getValor(),
                j.getStatus(), j.getDataPagamento(), j.getNumeroRecibo(), j.getContribuicaoId(), j.isCriadaNoPagamento());
    }
}
