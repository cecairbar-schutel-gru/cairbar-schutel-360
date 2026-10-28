package com.durvalcrm.contapagar.adapter.out.persistence;

import com.durvalcrm.contapagar.domain.PagamentoContaPagar;
import com.durvalcrm.contapagar.domain.PagamentoContaPagarRepository;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class PagamentoContaPagarJdbcAdapter implements PagamentoContaPagarRepository {

    private final JdbcClient jdbc;

    PagamentoContaPagarJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<PagamentoContaPagar> porChave(String chave) {
        return jdbc.sql("select * from pagamento_conta_pagar where chave_idempotencia = ?").param(chave)
                .query(PagamentoContaPagarJdbcAdapter::mapear).optional();
    }

    @Override
    public Optional<PagamentoContaPagar> travar(long id) {
        return jdbc.sql("select * from pagamento_conta_pagar where id = ? for update").param(id)
                .query(PagamentoContaPagarJdbcAdapter::mapear).optional();
    }

    @Override
    public List<PagamentoContaPagar> daConta(long contaPagarId) {
        return jdbc.sql("select * from pagamento_conta_pagar where conta_pagar_id = ? order by vencimento desc, id desc")
                .param(contaPagarId).query(PagamentoContaPagarJdbcAdapter::mapear).list();
    }

    @Override
    public List<PagamentoContaPagar> validosAte(LocalDate ate) {
        return jdbc.sql("select * from pagamento_conta_pagar where estornado_em is null and vencimento <= ?")
                .param(Date.valueOf(ate)).query(PagamentoContaPagarJdbcAdapter::mapear).list();
    }

    @Override
    public boolean pago(long contaPagarId, LocalDate vencimento) {
        return jdbc.sql("""
                select exists (select 1 from pagamento_conta_pagar
                               where conta_pagar_id = ? and vencimento = ? and estornado_em is null)""")
                .params(contaPagarId, Date.valueOf(vencimento)).query(Boolean.class).single();
    }

    @Override
    public boolean existeDaConta(long contaPagarId) {
        return jdbc.sql("select exists (select 1 from pagamento_conta_pagar where conta_pagar_id = ?)")
                .param(contaPagarId).query(Boolean.class).single();
    }

    @Override
    public PagamentoContaPagar salvar(PagamentoContaPagar p) {
        if (p.id() != null) {
            jdbc.sql("update pagamento_conta_pagar set lancamento_id = :lancamento, estornado_em = :estornado where id = :id")
                    .param("lancamento", p.lancamentoId())
                    .param("estornado", p.estornadoEm() == null ? null : Timestamp.from(p.estornadoEm()))
                    .param("id", p.id())
                    .update();
            return p;
        }
        long id = jdbc.sql("""
                insert into pagamento_conta_pagar (conta_pagar_id, vencimento, pago_em, valor, conta_id, conta_nome,
                    observacao, lancamento_id, chave_idempotencia, registrado_em, registrado_por_subject, registrado_por)
                values (:conta, :vencimento, :pago, :valor, :origem, :origemNome, :obs, :lancamento, :chave, :em,
                    :subject, :por)
                returning id""")
                .param("conta", p.contaPagarId())
                .param("vencimento", Date.valueOf(p.vencimento()))
                .param("pago", Date.valueOf(p.pagoEm()))
                .param("valor", p.valor())
                .param("origem", p.contaId())
                .param("origemNome", p.contaNome())
                .param("obs", p.observacao())
                .param("lancamento", p.lancamentoId())
                .param("chave", p.chaveIdempotencia())
                .param("em", Timestamp.from(p.registradoEm()))
                .param("subject", p.registradoPorSubject())
                .param("por", p.registradoPor())
                .query(Long.class)
                .single();
        return p.comId(id);
    }

    private static PagamentoContaPagar mapear(ResultSet rs, int linha) throws SQLException {
        Timestamp estornado = rs.getTimestamp("estornado_em");
        return new PagamentoContaPagar(rs.getLong("id"), rs.getLong("conta_pagar_id"),
                rs.getDate("vencimento").toLocalDate(), rs.getDate("pago_em").toLocalDate(), rs.getBigDecimal("valor"),
                rs.getLong("conta_id"), rs.getString("conta_nome"), rs.getString("observacao"),
                rs.getObject("lancamento_id", Long.class), rs.getString("chave_idempotencia"),
                rs.getTimestamp("registrado_em").toInstant(), rs.getString("registrado_por_subject"),
                rs.getString("registrado_por"), estornado == null ? null : estornado.toInstant());
    }
}
