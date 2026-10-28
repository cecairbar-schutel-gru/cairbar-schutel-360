package com.durvalcrm.contribuicao.adapter.out.persistence;

import com.durvalcrm.contribuicao.domain.CompetenciaPaga;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.contribuicao.domain.Pagamento;
import com.durvalcrm.contribuicao.domain.Recebimento;
import com.durvalcrm.contribuicao.domain.TipoContribuicao;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
class ContribuicaoPersistenceAdapter implements ContribuicaoRepository {

    private final SpringDataContribuicaoRepository repositorio;

    ContribuicaoPersistenceAdapter(SpringDataContribuicaoRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Override
    public Contribuicao salvar(Contribuicao c) {
        ContribuicaoJpaEntity entidade = c.getId() == null ? nova(c) : repositorio.findById(c.getId()).orElseThrow();
        entidade.atualizarSituacao(c.getLancamentoId(), c.getStatus(), c.getCanceladaEm(), c.getCanceladaPor(),
                c.getMotivoCancelamento());
        try {
            return paraDominio(repositorio.saveAndFlush(entidade));
        } catch (DataIntegrityViolationException e) {
            // Única violação possível na inserção: a mesma confirmação enviada em paralelo.
            throw new RegraDeNegocioException("CONFIRMACAO_REPETIDA", "Esta confirmação já está sendo processada.");
        }
    }

    @Override
    public Optional<Contribuicao> buscarPorId(long id) {
        return repositorio.findById(id).map(ContribuicaoPersistenceAdapter::paraDominio);
    }

    @Override
    public Optional<Contribuicao> buscarPorChaveIdempotencia(String chave) {
        return repositorio.findByChaveIdempotencia(chave).map(ContribuicaoPersistenceAdapter::paraDominio);
    }

    @Override
    public Optional<Contribuicao> buscarPorNumeroRecibo(String numero) {
        return repositorio.findByNumeroRecibo(numero).map(ContribuicaoPersistenceAdapter::paraDominio);
    }

    @Override
    public List<Contribuicao> listarPorDoadorNoAno(long doadorId, int ano) {
        return repositorio.findByDoadorIdAndDataFinanceiraBetweenOrderByRecebidaEmDescIdDesc(doadorId,
                LocalDate.of(ano, 1, 1), LocalDate.of(ano, 12, 31)).stream()
                .map(ContribuicaoPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public List<Integer> anosComContribuicao(long doadorId) {
        return repositorio.anos(doadorId);
    }

    @Override
    public List<Contribuicao> listarDoDiaDoOperador(LocalDate data, String operadorSubject) {
        return repositorio.findByDataFinanceiraAndOperadorSubject(data, operadorSubject).stream()
                .map(ContribuicaoPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public List<Contribuicao> listarUltimasDoOperador(String operadorSubject, int limite) {
        return repositorio.findByOperadorSubjectOrderByRecebidaEmDescIdDesc(operadorSubject, PageRequest.of(0, limite)).stream()
                .map(ContribuicaoPersistenceAdapter::paraDominio)
                .toList();
    }

    private static ContribuicaoJpaEntity nova(Contribuicao c) {
        return new ContribuicaoJpaEntity(c.getTipo(), c.getDoadorId(), c.getValorDoacao(), c.total(), c.getObservacao(),
                c.getOperadorSubject(), c.getOperadorNome(), c.getRecebidaEm(),
                c.getDataFinanceira(), c.getNumeroRecibo(), c.getChaveIdempotencia(),
                c.getCompetencias().stream().map(p -> new CompetenciaPagaEmbeddable(p.mes().atDay(1), p.valor())).toList(),
                c.getPagamentos().stream()
                        .map(p -> new PagamentoEmbeddable(p.meio(), p.contaId(), p.contaNome(), p.valor(), p.tipoCartao()))
                        .toList());
    }

    private static Contribuicao paraDominio(ContribuicaoJpaEntity j) {
        Recebimento r = new Recebimento(j.getDoadorId(), j.getTipo() == TipoContribuicao.DOACAO_ANONIMA,
                j.getCompetencias().stream().map(p -> new CompetenciaPaga(YearMonth.from(p.getMes()), p.getValor())).toList(),
                j.getValorDoacao(),
                j.getPagamentos().stream()
                        .map(p -> new Pagamento(p.getMeio(), p.getContaId(), p.getContaNome(), p.getValor(), p.getTipoCartao()))
                        .toList(),
                j.getObservacao());
        return Contribuicao.reconstituir(j.getId(), r, j.getOperadorSubject(), j.getOperadorNome(), j.getRecebidaEm(),
                j.getDataFinanceira(), j.getNumeroRecibo(), j.getChaveIdempotencia(), j.getLancamentoId(), j.getStatus(),
                j.getCanceladaEm(), j.getCanceladaPor(), j.getMotivoCancelamento());
    }
}
