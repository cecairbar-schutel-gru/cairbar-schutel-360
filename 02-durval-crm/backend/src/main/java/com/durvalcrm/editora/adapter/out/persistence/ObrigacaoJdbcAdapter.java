package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.Obrigacao;
import com.durvalcrm.editora.domain.ObrigacaoRepository;
import com.durvalcrm.editora.domain.OrigemObrigacao;
import com.durvalcrm.editora.domain.StatusObrigacao;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ObrigacaoJdbcAdapter implements ObrigacaoRepository {

    private final JdbcClient jdbc;

    ObrigacaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Obrigacao salvar(Obrigacao o) {
        if (o.getId() != null) {
            jdbc.sql("""
                    update obrigacao_editora set valor_pago = :pago, status = :status, estornada_em = :estornada
                    where id = :id""")
                    .param("pago", o.getValorPago())
                    .param("status", o.getStatus().name())
                    .param("estornada", o.getEstornadaEm() == null ? null : Timestamp.from(o.getEstornadaEm()))
                    .param("id", o.getId())
                    .update();
            return o;
        }
        long id = jdbc.sql("""
                insert into obrigacao_editora (editora_id, remessa_id, produto_id, origem_tipo, origem_id, quantidade,
                    preco_unitario, repasse_percentual, valor, valor_pago, status, criada_em)
                values (:editora, :remessa, :produto, :origem, :origemId, :quantidade, :preco, :percentual, :valor,
                    :pago, :status, :criada)
                returning id""")
                .param("editora", o.getEditoraId())
                .param("remessa", o.getRemessaId())
                .param("produto", o.getProdutoId())
                .param("origem", o.getOrigem().name())
                .param("origemId", o.getOrigemId())
                .param("quantidade", o.getQuantidade())
                .param("preco", o.getPrecoUnitario())
                .param("percentual", o.getRepassePercentual())
                .param("valor", o.getValor())
                .param("pago", o.getValorPago())
                .param("status", o.getStatus().name())
                .param("criada", Timestamp.from(o.getCriadaEm()))
                .query(Long.class)
                .single();
        return Obrigacao.reconstituir(id, o.getEditoraId(), o.getRemessaId(), o.getProdutoId(), o.getOrigem(),
                o.getOrigemId(), o.getQuantidade(), o.getPrecoUnitario(), o.getRepassePercentual(), o.getValor(),
                o.getValorPago(), o.getStatus(), o.getCriadaEm(), o.getEstornadaEm());
    }

    @Override
    public List<Obrigacao> listarPorOrigem(OrigemObrigacao origem, long origemId) {
        return jdbc.sql("select * from obrigacao_editora where origem_tipo = :origem and origem_id = :id order by id")
                .param("origem", origem.name())
                .param("id", origemId)
                .query(ObrigacaoJdbcAdapter::mapear)
                .list();
    }

    @Override
    public List<Obrigacao> abertas(long editoraId, boolean travar) {
        return jdbc.sql("""
                select * from obrigacao_editora where editora_id = ? and status in ('ABERTA', 'PARCIALMENTE_PAGA')
                order by criada_em, id""" + (travar ? " for update" : ""))
                .param(editoraId)
                .query(ObrigacaoJdbcAdapter::mapear)
                .list();
    }

    @Override
    public List<Obrigacao> obter(Collection<Long> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select * from obrigacao_editora where id in (:ids) order by criada_em, id for update")
                .param("ids", ids)
                .query(ObrigacaoJdbcAdapter::mapear)
                .list();
    }

    @Override
    public BigDecimal creditoDisponivel(long editoraId) {
        return jdbc.sql("""
                select coalesce((select sum(valor) from credito_editora where editora_id = :e), 0)
                     - coalesce((select sum(credito_aplicado) from pagamento_editora
                                 where editora_id = :e and estornado_em is null), 0)""")
                .param("e", editoraId)
                .query(BigDecimal.class)
                .single();
    }

    @Override
    public void registrarCredito(long editoraId, long obrigacaoId, BigDecimal valor, Instant em) {
        jdbc.sql("""
                insert into credito_editora (editora_id, obrigacao_id, valor, criado_em)
                values (:editora, :obrigacao, :valor, :em)""")
                .param("editora", editoraId)
                .param("obrigacao", obrigacaoId)
                .param("valor", valor)
                .param("em", Timestamp.from(em))
                .update();
    }

    private static Obrigacao mapear(ResultSet rs, int linha) throws SQLException {
        Timestamp estornada = rs.getTimestamp("estornada_em");
        return Obrigacao.reconstituir(rs.getLong("id"), rs.getLong("editora_id"), rs.getLong("remessa_id"),
                rs.getLong("produto_id"), OrigemObrigacao.valueOf(rs.getString("origem_tipo")), rs.getLong("origem_id"),
                rs.getInt("quantidade"), rs.getBigDecimal("preco_unitario"), rs.getBigDecimal("repasse_percentual"),
                rs.getBigDecimal("valor"), rs.getBigDecimal("valor_pago"), StatusObrigacao.valueOf(rs.getString("status")),
                rs.getTimestamp("criada_em").toInstant(), estornada == null ? null : estornada.toInstant());
    }
}
