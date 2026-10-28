package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.ItemRemessa;
import com.durvalcrm.editora.domain.Remessa;
import com.durvalcrm.editora.domain.RemessaRepository;
import com.durvalcrm.editora.domain.StatusRemessa;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class RemessaJdbcAdapter implements RemessaRepository {

    private final JdbcClient jdbc;

    RemessaJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<ItemRemessa> item(long remessaId, long produtoId) {
        return jdbc.sql("""
                select r.id, r.codigo, r.editora_id, i.produto_id, i.repasse_percentual
                from remessa r join remessa_item i on i.remessa_id = r.id
                where r.id = :remessa and i.produto_id = :produto""")
                .param("remessa", remessaId)
                .param("produto", produtoId)
                .query((rs, n) -> new ItemRemessa(rs.getLong(1), rs.getString(2), rs.getLong(3), rs.getLong(4),
                        rs.getBigDecimal(5)))
                .optional();
    }

    @Override
    public Optional<Remessa> obter(long id) {
        return carregar("select * from remessa where id = ?", id);
    }

    @Override
    public Optional<Remessa> travar(long id) {
        return carregar("select * from remessa where id = ? for update", id);
    }

    @Override
    public Remessa salvar(Remessa r) {
        if (r.getId() != null) {
            jdbc.sql("""
                    update remessa set status = :status, cancelada_em = :em, cancelada_por = :por,
                        motivo_cancelamento = :motivo where id = :id""")
                    .param("status", r.getStatus().name())
                    .param("em", r.getCanceladaEm() == null ? null : Timestamp.from(r.getCanceladaEm()))
                    .param("por", r.getCanceladaPor())
                    .param("motivo", r.getMotivoCancelamento())
                    .param("id", r.getId())
                    .update();
            return r;
        }
        int ano = r.getRecebidaEm().getYear();
        // Linha do ano travada até o fim da transação: códigos sem lacunas nem repetição.
        jdbc.sql("insert into sequencia_remessa (ano, ultimo) values (?, 0) on conflict (ano) do nothing")
                .param(ano).update();
        int numero = jdbc.sql("update sequencia_remessa set ultimo = ultimo + 1 where ano = ? returning ultimo")
                .param(ano).query(Integer.class).single();
        String codigo = Remessa.codigo(ano, numero);
        long id = jdbc.sql("""
                insert into remessa (codigo, editora_id, recebida_em, numero_documento, status, registrada_em,
                    registrada_por)
                values (:codigo, :editora, :recebida, :documento, :status, :em, :por)
                returning id""")
                .param("codigo", codigo)
                .param("editora", r.getEditoraId())
                .param("recebida", Date.valueOf(r.getRecebidaEm()))
                .param("documento", r.getNumeroDocumento())
                .param("status", r.getStatus().name())
                .param("em", Timestamp.from(r.getRegistradaEm()))
                .param("por", r.getRegistradaPor())
                .query(Long.class)
                .single();
        for (Remessa.Item i : r.getItens()) {
            jdbc.sql("""
                    insert into remessa_item (remessa_id, produto_id, quantidade_recebida, repasse_percentual)
                    values (?, ?, ?, ?)""")
                    .params(id, i.produtoId(), i.quantidade(), i.repassePercentual())
                    .update();
        }
        return Remessa.reconstituir(id, codigo, r.getEditoraId(), r.getRecebidaEm(), r.getNumeroDocumento(),
                r.getStatus(), r.getItens(), r.getRegistradaEm(), r.getRegistradaPor(), null, null, null);
    }

    @Override
    public boolean possuiBaixaPendente(long remessaId) {
        return jdbc.sql("""
                select exists (select 1 from solicitacao_estoque
                               where remessa_id = ? and tipo = 'BAIXA' and status = 'PENDENTE')""")
                .param(remessaId)
                .query(Boolean.class)
                .single();
    }

    private Optional<Remessa> carregar(String sql, long id) {
        return jdbc.sql(sql).param(id).query(RemessaJdbcAdapter::mapear).optional().map(r -> {
            List<Remessa.Item> itens = jdbc.sql("""
                    select produto_id, quantidade_recebida, repasse_percentual from remessa_item
                    where remessa_id = ? order by produto_id""")
                    .param(id)
                    .query((rs, n) -> new Remessa.Item(rs.getLong(1), rs.getInt(2), rs.getBigDecimal(3)))
                    .list();
            return Remessa.reconstituir(r.getId(), r.getCodigo(), r.getEditoraId(), r.getRecebidaEm(),
                    r.getNumeroDocumento(), r.getStatus(), itens, r.getRegistradaEm(), r.getRegistradaPor(),
                    r.getCanceladaEm(), r.getCanceladaPor(), r.getMotivoCancelamento());
        });
    }

    private static Remessa mapear(ResultSet rs, int linha) throws SQLException {
        return Remessa.reconstituir(rs.getLong("id"), rs.getString("codigo"), rs.getLong("editora_id"),
                rs.getDate("recebida_em").toLocalDate(), rs.getString("numero_documento"),
                StatusRemessa.valueOf(rs.getString("status")), List.of(), instante(rs, "registrada_em"),
                rs.getString("registrada_por"), instante(rs, "cancelada_em"), rs.getString("cancelada_por"),
                rs.getString("motivo_cancelamento"));
    }

    static Instant instante(ResultSet rs, String coluna) throws SQLException {
        Timestamp t = rs.getTimestamp(coluna);
        return t == null ? null : t.toInstant();
    }
}
