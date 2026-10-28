package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.domain.EntradaDoacao;
import com.durvalcrm.estoque.domain.EntradaDoacaoRepository;
import com.durvalcrm.estoque.domain.ItemEntrada;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Os itens da entrada são os movimentos "Entrada por doação" que apontam para ela. */
@Component
class EntradaDoacaoJdbcAdapter implements EntradaDoacaoRepository {

    private final JdbcClient jdbc;

    EntradaDoacaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public EntradaDoacao salvar(EntradaDoacao e) {
        if (e.getId() != null) {
            jdbc.sql("""
                    update entrada_doacao set cancelada_em = ?, cancelada_por_nome = ?, motivo_cancelamento = ?
                    where id = ?""")
                    .params(e.getCanceladaEm() == null ? null : Timestamp.from(e.getCanceladaEm()),
                            e.getCanceladaPorNome(), e.getMotivoCancelamento(), e.getId())
                    .update();
            return e;
        }
        long id = jdbc.sql("""
                insert into entrada_doacao (observacao, registrada_em, registrada_por, registrada_por_nome)
                values (?, ?, ?, ?) returning id""")
                .params(e.getObservacao(), Timestamp.from(e.getRegistradaEm()), e.getRegistradaPor(),
                        e.getRegistradaPorNome())
                .query(Long.class)
                .single();
        return EntradaDoacao.reconstituir(id, e.getItens(), e.getObservacao(), e.getRegistradaEm(),
                e.getRegistradaPor(), e.getRegistradaPorNome(), null, null, null);
    }

    @Override
    public Optional<EntradaDoacao> obter(long id) {
        List<ItemEntrada> itens = jdbc.sql("""
                select produto_id, quantidade from movimento_estoque
                where referencia_tipo = ? and referencia_id = ? and tipo = 'ENTRADA_DOACAO' order by id""")
                .params(EntradaEstoqueUseCase.REFERENCIA_DOACAO, id)
                .query((rs, i) -> new ItemEntrada(rs.getLong(1), rs.getInt(2)))
                .list();
        return jdbc.sql("select * from entrada_doacao where id = ?")
                .param(id)
                .query((rs, i) -> {
                    Timestamp cancelada = rs.getTimestamp("cancelada_em");
                    return EntradaDoacao.reconstituir(rs.getLong("id"), itens, rs.getString("observacao"),
                            rs.getTimestamp("registrada_em").toInstant(), rs.getString("registrada_por"),
                            rs.getString("registrada_por_nome"), cancelada == null ? null : cancelada.toInstant(),
                            rs.getString("cancelada_por_nome"), rs.getString("motivo_cancelamento"));
                })
                .optional();
    }
}
