package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.ClassificacaoRepository;
import com.durvalcrm.financeiro.domain.Reclassificacao;
import jakarta.persistence.EntityManager;
import java.sql.Timestamp;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * A linha de categoria muda no lugar (os relatórios usam a classificação atual) e a anterior vai
 * para o histórico. Só a classificação muda; valor, data e conta ficam como estavam.
 */
@Component
class ClassificacaoJdbcAdapter implements ClassificacaoRepository {

    private final JdbcClient jdbc;
    private final EntityManager entityManager;

    ClassificacaoJdbcAdapter(JdbcClient jdbc, EntityManager entityManager) {
        this.jdbc = jdbc;
        this.entityManager = entityManager;
    }

    @Override
    public void reclassificar(Reclassificacao r) {
        jdbc.sql("""
                insert into historico_classificacao (lancamento_id, ordem, categoria_anterior, categoria_nova,
                    alterado_por, alterado_por_nome, alterado_em, motivo) values (?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(r.lancamentoId(), r.ordem(), r.categoriaAnterior(), r.categoriaNova(), r.alteradoPor(),
                        r.alteradoPorNome(), Timestamp.from(r.alteradoEm()), r.motivo())
                .update();
        jdbc.sql("update lancamento_linha_categoria set categoria_codigo = ? where lancamento_id = ? and ordem = ?")
                .params(r.categoriaNova(), r.lancamentoId(), r.ordem())
                .update();
        // O lançamento pode estar no contexto de persistência desta transação com a categoria antiga.
        LancamentoJpaEntity carregado = entityManager.find(LancamentoJpaEntity.class, r.lancamentoId());
        if (carregado != null) {
            entityManager.refresh(carregado);
        }
    }

    @Override
    public List<Reclassificacao> historico(long lancamentoId) {
        return jdbc.sql("select * from historico_classificacao where lancamento_id = ? order by alterado_em, id")
                .param(lancamentoId)
                .query((rs, i) -> new Reclassificacao(rs.getLong("lancamento_id"), rs.getInt("ordem"),
                        rs.getString("categoria_anterior"), rs.getString("categoria_nova"), rs.getString("alterado_por"),
                        rs.getString("alterado_por_nome"), rs.getTimestamp("alterado_em").toInstant(),
                        rs.getString("motivo")))
                .list();
    }
}
