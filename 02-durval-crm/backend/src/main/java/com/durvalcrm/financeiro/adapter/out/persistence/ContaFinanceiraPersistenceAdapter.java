package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.ContaFinanceira;
import com.durvalcrm.financeiro.domain.ContaFinanceiraRepository;
import com.durvalcrm.financeiro.domain.TipoConta;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
class ContaFinanceiraPersistenceAdapter implements ContaFinanceiraRepository {

    private final SpringDataContaFinanceiraRepository repositorio;

    ContaFinanceiraPersistenceAdapter(SpringDataContaFinanceiraRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Override
    public Optional<ContaFinanceira> buscarPorId(long id) {
        return repositorio.findById(id).map(ContaFinanceiraPersistenceAdapter::paraDominio);
    }

    @Override
    public Optional<ContaFinanceira> travar(long id) {
        return repositorio.travar(id).map(ContaFinanceiraPersistenceAdapter::paraDominio);
    }

    @Override
    public List<ContaFinanceira> listarAtivas(TipoConta tipo) {
        return repositorio.findByTipoAndAtivaTrueOrderByNomeAsc(tipo).stream()
                .map(ContaFinanceiraPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public List<ContaFinanceira> listar() {
        return repositorio.findAll().stream()
                .map(ContaFinanceiraPersistenceAdapter::paraDominio)
                .sorted(Comparator.comparing(ContaFinanceira::tipo).thenComparing(ContaFinanceira::nome,
                        String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    public ContaFinanceira cartaoAReceber() {
        return paraDominio(repositorio.findFirstByTipo(TipoConta.CARTAO_A_RECEBER));
    }

    @Override
    public boolean codigoEmUso(String codigo) {
        return repositorio.existsByCodigo(codigo);
    }

    @Override
    public ContaFinanceira salvar(ContaFinanceira c) {
        return paraDominio(repositorio.saveAndFlush(new ContaFinanceiraJpaEntity(c.id() == 0 ? null : c.id(), c.codigo(),
                c.nome(), c.tipo(), c.ativa(), c.localizacao(), c.banco(), c.agencia(), c.numeroConta(),
                c.saldoInicial(), c.dataCorte())));
    }

    @Override
    public void excluir(long id) {
        repositorio.deleteById(id);
        repositorio.flush();
    }

    private static ContaFinanceira paraDominio(ContaFinanceiraJpaEntity j) {
        return new ContaFinanceira(j.getId(), j.getCodigo(), j.getNome(), j.getTipo(), j.isAtiva(), j.getLocalizacao(),
                j.getBanco(), j.getAgencia(), j.getNumeroConta(), j.getSaldoInicial(), j.getDataCorte());
    }
}
