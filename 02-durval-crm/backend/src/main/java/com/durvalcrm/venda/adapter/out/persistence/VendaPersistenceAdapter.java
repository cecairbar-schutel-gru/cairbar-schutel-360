package com.durvalcrm.venda.adapter.out.persistence;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.venda.domain.FiltroVendas;
import com.durvalcrm.venda.domain.ItemVenda;
import com.durvalcrm.venda.domain.LoteVendido;
import com.durvalcrm.venda.domain.PagamentoVenda;
import com.durvalcrm.venda.domain.Venda;
import com.durvalcrm.venda.domain.VendaRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class VendaPersistenceAdapter implements VendaRepository {

    private final SpringDataVendaRepository repositorio;
    private final JdbcClient jdbc;

    VendaPersistenceAdapter(SpringDataVendaRepository repositorio, JdbcClient jdbc) {
        this.repositorio = repositorio;
        this.jdbc = jdbc;
    }

    @Override
    public Venda salvar(Venda v) {
        VendaJpaEntity entidade = v.getId() == null ? nova(v) : repositorio.findById(v.getId()).orElseThrow();
        entidade.atualizarSituacao(v.getLotes().stream().map(VendaPersistenceAdapter::lote).toList(),
                v.getLancamentoId(), v.getStatus(), v.getCanceladaEm(), v.getCanceladaPor(), v.getMotivoCancelamento());
        try {
            return paraDominio(repositorio.saveAndFlush(entidade));
        } catch (DataIntegrityViolationException e) {
            // Violações possíveis na inserção: a mesma confirmação enviada em paralelo, ou a mesma venda
            // cancelada refeita duas vezes ao mesmo tempo.
            throw new RegraDeNegocioException("CONFIRMACAO_REPETIDA", "Esta confirmação já está sendo processada.");
        }
    }

    @Override
    public Optional<Venda> buscarPorId(long id) {
        return repositorio.findById(id).map(VendaPersistenceAdapter::paraDominio);
    }

    @Override
    public Optional<Venda> buscarPorChaveIdempotencia(String chave) {
        return repositorio.findByChaveIdempotencia(chave).map(VendaPersistenceAdapter::paraDominio);
    }

    @Override
    public Optional<Venda> buscarRefeitaDe(long vendaId) {
        return repositorio.findByRefazVendaId(vendaId).map(VendaPersistenceAdapter::paraDominio);
    }

    /** Filtro dinâmico em SQL para obter os ids; as vendas são carregadas pelo JPA. */
    @Override
    public List<Venda> listar(FiltroVendas f) {
        List<String> condicoes = new ArrayList<>();
        condicoes.add("true");
        if (f.de() != null) {
            condicoes.add("data_financeira >= :de");
        }
        if (f.ate() != null) {
            condicoes.add("data_financeira <= :ate");
        }
        if (f.vendedorSubject() != null) {
            condicoes.add("vendedor_subject = :vendedor");
        }
        if (f.status() != null) {
            condicoes.add("status = :status");
        }
        if (f.pdv() != null) {
            condicoes.add("pdv = :pdv");
        }
        if (f.numero() != null) {
            condicoes.add("numero = :numero");
        }
        JdbcClient.StatementSpec consulta = jdbc.sql("select id from venda where " + String.join(" and ", condicoes)
                + " order by confirmada_em desc, id desc limit :limite").param("limite", f.limite());
        if (f.de() != null) {
            consulta = consulta.param("de", f.de());
        }
        if (f.ate() != null) {
            consulta = consulta.param("ate", f.ate());
        }
        if (f.vendedorSubject() != null) {
            consulta = consulta.param("vendedor", f.vendedorSubject());
        }
        if (f.status() != null) {
            consulta = consulta.param("status", f.status().name());
        }
        if (f.pdv() != null) {
            consulta = consulta.param("pdv", f.pdv());
        }
        if (f.numero() != null) {
            consulta = consulta.param("numero", f.numero());
        }
        List<Long> ids = consulta.query(Long.class).list();
        return repositorio.findAllById(ids).stream()
                .sorted(Comparator.comparingInt(e -> ids.indexOf(e.getId())))
                .map(VendaPersistenceAdapter::paraDominio)
                .toList();
    }

    @Override
    public List<Venda> listarDoDiaDoVendedorEDoPdv(LocalDate data, String vendedorSubject) {
        return repositorio.doDiaDoVendedorEDoPdv(data, vendedorSubject).stream()
                .map(VendaPersistenceAdapter::paraDominio)
                .toList();
    }

    private static VendaJpaEntity nova(Venda v) {
        return new VendaJpaEntity(v.getNumero(), v.getVendedorSubject(),
                v.getVendedorNome(), v.isPdv(), v.getConfirmadaEm(), v.getDataFinanceira(), v.total(), v.getChaveIdempotencia(),
                v.getRefazVendaId(),
                v.getItens().stream().map(i -> new ItemVendaEmbeddable(i.produtoId(), i.produtoNome(), i.tipo(),
                        i.quantidade(), i.precoUnitario())).toList(),
                v.getPagamentos().stream().map(p -> new PagamentoVendaEmbeddable(p.meio(), p.contaId(), p.contaNome(),
                        p.valor(), p.tipoCartao())).toList());
    }

    private static LoteVendidoEmbeddable lote(LoteVendido l) {
        return new LoteVendidoEmbeddable(l.produtoId(), l.remessaId(), l.remessaCodigo(), l.quantidade(),
                l.repassePercentual(), l.obrigacaoId(), l.valorObrigacao());
    }

    private static Venda paraDominio(VendaJpaEntity j) {
        return Venda.reconstituir(j.getId(), j.getNumero(), j.getVendedorSubject(),
                j.getVendedorNome(), j.isPdv(), j.getConfirmadaEm(), j.getDataFinanceira(),
                j.getItens().stream().map(i -> new ItemVenda(i.getProdutoId(), i.getProdutoNome(), i.getTipo(),
                        i.getQuantidade(), i.getPrecoUnitario())).toList(),
                j.getPagamentos().stream().map(p -> new PagamentoVenda(p.getMeio(), p.getContaId(), p.getContaNome(),
                        p.getValor(), p.getTipoCartao())).toList(),
                j.getChaveIdempotencia(), j.getRefazVendaId(),
                j.getLotes().stream().map(l -> new LoteVendido(l.getProdutoId(), l.getRemessaId(), l.getRemessaCodigo(),
                        l.getQuantidade(), l.getRepassePercentual(), l.getObrigacaoId(), l.getValorObrigacao())).toList(),
                j.getLancamentoId(), j.getStatus(), j.getCanceladaEm(), j.getCanceladaPor(), j.getMotivoCancelamento());
    }
}
