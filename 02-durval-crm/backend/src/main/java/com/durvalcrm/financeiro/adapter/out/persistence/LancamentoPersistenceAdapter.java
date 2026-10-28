package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.Lancamento;
import com.durvalcrm.financeiro.domain.LancamentoRepository;
import com.durvalcrm.financeiro.domain.LinhaCategoria;
import com.durvalcrm.financeiro.domain.LinhaConta;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class LancamentoPersistenceAdapter implements LancamentoRepository {

    private final SpringDataLancamentoRepository repositorio;
    private final SpringDataContaFinanceiraRepository contas;
    private final JdbcClient jdbc;

    LancamentoPersistenceAdapter(SpringDataLancamentoRepository repositorio,
            SpringDataContaFinanceiraRepository contas, JdbcClient jdbc) {
        this.repositorio = repositorio;
        this.contas = contas;
        this.jdbc = jdbc;
    }

    @Override
    public Lancamento salvar(Lancamento l) {
        return paraDominio(repositorio.saveAndFlush(new LancamentoJpaEntity(l.getDataFinanceira(), l.getOrigemTipo(),
                l.getOrigemId(), l.natureza().name(), l.getDescricao(), l.getCriadoPor(), l.getCriadoPorNome(),
                l.getCriadoEm(), l.getEstornaLancamentoId(), l.getCorrigeLancamentoId(), l.getMotivo(),
                l.getReferenciaExterna(), l.getChaveIdempotencia(),
                l.getLinhasConta().stream().map(c -> new LinhaContaEmbeddable(c.contaId(), c.valor(), c.tipoCartao())).toList(),
                l.getLinhasCategoria().stream().map(c -> new LinhaCategoriaEmbeddable(c.categoria(), c.valor())).toList())));
    }

    @Override
    public Optional<Lancamento> buscarPorId(long id) {
        return repositorio.findById(id).map(LancamentoPersistenceAdapter::paraDominio);
    }

    @Override
    public List<Lancamento> buscarTodos(Collection<Long> ids) {
        return repositorio.findAllById(ids).stream().map(LancamentoPersistenceAdapter::paraDominio).toList();
    }

    @Override
    public Optional<Lancamento> buscarPorChave(String chaveIdempotencia) {
        return repositorio.findByChaveIdempotencia(chaveIdempotencia).map(LancamentoPersistenceAdapter::paraDominio);
    }

    @Override
    public boolean existeEstornoDe(long lancamentoId) {
        return repositorio.existsByEstornaLancamentoId(lancamentoId);
    }

    @Override
    public BigDecimal saldo(long contaId) {
        BigDecimal inicial = contas.findById(contaId).map(ContaFinanceiraJpaEntity::getSaldoInicial)
                .orElse(BigDecimal.ZERO);
        return inicial.add(repositorio.somaDasLinhas(contaId));
    }

    @Override
    public boolean contaTemLancamentos(long contaId) {
        return repositorio.contaTemLancamentos(contaId);
    }

    @Override
    public boolean conciliado(long lancamentoId) {
        return jdbc.sql("select exists(select 1 from lancamento_linha_conta where lancamento_id = ? and conciliacao_id is not null)")
                .param(lancamentoId).query(Boolean.class).single();
    }

    @Override
    public boolean origemIntocada(String origemTipo, long origemId) {
        return jdbc.sql("""
                select not exists (
                    select 1 from lancamento_financeiro l
                    where l.origem_tipo = :tipo and l.origem_id = :id and (
                        exists (select 1 from lancamento_financeiro e where e.estorna_lancamento_id = l.id
                                                                         or e.corrige_lancamento_id = l.id)
                        or exists (select 1 from historico_classificacao h where h.lancamento_id = l.id)
                        or exists (select 1 from lancamento_linha_conta lc
                                   where lc.lancamento_id = l.id and lc.conciliacao_id is not null)
                        or exists (select 1 from conciliacao_item ci where ci.lancamento_id = l.id)
                        or exists (select 1 from lancamento_anexo a where a.lancamento_id = l.id)))""")
                .param("tipo", origemTipo).param("id", origemId).query(Boolean.class).single();
    }

    @Override
    public int excluirDaOrigem(String origemTipo, long origemId) {
        String ids = "select id from lancamento_financeiro where origem_tipo = :tipo and origem_id = :id";
        jdbc.sql("delete from lancamento_linha_categoria where lancamento_id in (" + ids + ")")
                .param("tipo", origemTipo).param("id", origemId).update();
        jdbc.sql("delete from lancamento_linha_conta where lancamento_id in (" + ids + ")")
                .param("tipo", origemTipo).param("id", origemId).update();
        return jdbc.sql("delete from lancamento_financeiro where origem_tipo = :tipo and origem_id = :id")
                .param("tipo", origemTipo).param("id", origemId).update();
    }

    private static Lancamento paraDominio(LancamentoJpaEntity j) {
        return Lancamento.reconstituir(j.getId(), j.getDataFinanceira(), j.getOrigemTipo(), j.getOrigemId(),
                j.getDescricao(), j.getCriadoPor(), j.getCriadoPorNome(), j.getCriadoEm(), j.getEstornaLancamentoId(),
                j.getCorrigeLancamentoId(), j.getMotivo(), j.getReferenciaExterna(), j.getChaveIdempotencia(),
                j.getLinhasConta().stream().map(c -> new LinhaConta(c.getContaId(), c.getValor(), c.getTipoCartao())).toList(),
                j.getLinhasCategoria().stream().map(c -> new LinhaCategoria(c.getCategoria(), c.getValor())).toList());
    }
}
