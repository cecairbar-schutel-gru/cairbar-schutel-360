package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.Alocacao;
import com.durvalcrm.editora.domain.MeioPagamentoEditora;
import com.durvalcrm.editora.domain.PagamentoEditora;
import com.durvalcrm.editora.domain.PagamentoEditoraRepository;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class PagamentoEditoraJdbcAdapter implements PagamentoEditoraRepository {

    private final JdbcClient jdbc;

    PagamentoEditoraJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public PagamentoEditora salvar(PagamentoEditora p) {
        if (p.getId() != null) {
            jdbc.sql("update pagamento_editora set lancamento_id = :lancamento, estornado_em = :estornado where id = :id")
                    .param("lancamento", p.getLancamentoId())
                    .param("estornado", p.getEstornadoEm() == null ? null : Timestamp.from(p.getEstornadoEm()))
                    .param("id", p.getId())
                    .update();
            return p;
        }
        long id = jdbc.sql("""
                insert into pagamento_editora (editora_id, pago_em, valor, credito_aplicado, conta_id, conta_nome, meio,
                    observacao, lancamento_id, chave_idempotencia, registrado_em, registrado_por_subject, registrado_por)
                values (:editora, :pago, :valor, :credito, :conta, :contaNome, :meio, :obs, :lancamento, :chave, :em,
                    :subject, :por)
                returning id""")
                .param("editora", p.getEditoraId())
                .param("pago", Date.valueOf(p.getPagoEm()))
                .param("valor", p.getValor())
                .param("credito", p.getCreditoAplicado())
                .param("conta", p.getContaId())
                .param("contaNome", p.getContaNome())
                .param("meio", p.getMeio().name())
                .param("obs", p.getObservacao())
                .param("lancamento", p.getLancamentoId())
                .param("chave", p.getChaveIdempotencia())
                .param("em", Timestamp.from(p.getRegistradoEm()))
                .param("subject", p.getRegistradoPorSubject())
                .param("por", p.getRegistradoPor())
                .query(Long.class)
                .single();
        for (Alocacao a : p.getAlocacoes()) {
            jdbc.sql("insert into alocacao_pagamento_editora (pagamento_id, obrigacao_id, valor) values (?, ?, ?)")
                    .params(id, a.obrigacaoId(), a.valor())
                    .update();
        }
        return PagamentoEditora.reconstituir(id, p.getEditoraId(), p.getPagoEm(), p.getValor(), p.getCreditoAplicado(),
                p.getContaId(), p.getContaNome(), p.getMeio(), p.getObservacao(), p.getLancamentoId(),
                p.getChaveIdempotencia(), p.getRegistradoEm(), p.getRegistradoPorSubject(), p.getRegistradoPor(), null,
                p.getAlocacoes());
    }

    @Override
    public Optional<PagamentoEditora> obter(long id) {
        return jdbc.sql("select * from pagamento_editora where id = ?").param(id).query(this::mapear).optional();
    }

    @Override
    public Optional<PagamentoEditora> travar(long id) {
        return jdbc.sql("select * from pagamento_editora where id = ? for update").param(id).query(this::mapear)
                .optional();
    }

    @Override
    public Optional<PagamentoEditora> porChave(String chave) {
        return jdbc.sql("select * from pagamento_editora where chave_idempotencia = ?").param(chave).query(this::mapear)
                .optional();
    }

    private PagamentoEditora mapear(ResultSet rs, int linha) throws SQLException {
        long id = rs.getLong("id");
        List<Alocacao> alocacoes = jdbc.sql("""
                select a.obrigacao_id, a.valor from alocacao_pagamento_editora a
                join obrigacao_editora o on o.id = a.obrigacao_id
                where a.pagamento_id = ? order by o.criada_em, o.id""")
                .param(id)
                .query((r, n) -> new Alocacao(r.getLong(1), r.getBigDecimal(2)))
                .list();
        return PagamentoEditora.reconstituir(id, rs.getLong("editora_id"), rs.getDate("pago_em").toLocalDate(),
                rs.getBigDecimal("valor"), rs.getBigDecimal("credito_aplicado"), rs.getLong("conta_id"),
                rs.getString("conta_nome"), MeioPagamentoEditora.valueOf(rs.getString("meio")),
                rs.getString("observacao"), rs.getObject("lancamento_id", Long.class),
                rs.getString("chave_idempotencia"), rs.getTimestamp("registrado_em").toInstant(),
                rs.getString("registrado_por_subject"), rs.getString("registrado_por"),
                RemessaJdbcAdapter.instante(rs, "estornado_em"), alocacoes);
    }
}
