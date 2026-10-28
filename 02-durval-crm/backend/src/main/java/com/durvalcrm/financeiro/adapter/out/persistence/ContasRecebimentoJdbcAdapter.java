package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.ContasRecebimento;
import com.durvalcrm.financeiro.domain.ContasRecebimentoRepository;
import com.durvalcrm.financeiro.domain.Lancamento;
import java.sql.Timestamp;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ContasRecebimentoJdbcAdapter implements ContasRecebimentoRepository {

    private final JdbcClient jdbc;

    ContasRecebimentoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ContasRecebimento obter() {
        return jdbc.sql("select dinheiro_conta_id, pix_conta_id from conta_recebimento where id = 1")
                .query((rs, i) -> new ContasRecebimento(rs.getObject("dinheiro_conta_id", Long.class),
                        rs.getObject("pix_conta_id", Long.class)))
                .optional()
                .orElse(ContasRecebimento.NENHUMA);
    }

    @Override
    public void salvar(ContasRecebimento c, Lancamento.Autor autor) {
        jdbc.sql("""
                insert into conta_recebimento (id, dinheiro_conta_id, pix_conta_id, atualizado_por, atualizado_por_nome,
                    atualizado_em)
                values (1, ?, ?, ?, ?, ?)
                on conflict (id) do update set dinheiro_conta_id = excluded.dinheiro_conta_id,
                    pix_conta_id = excluded.pix_conta_id, atualizado_por = excluded.atualizado_por,
                    atualizado_por_nome = excluded.atualizado_por_nome, atualizado_em = excluded.atualizado_em""")
                .params(c.dinheiroContaId(), c.pixContaId(), autor.subject(), autor.nome(), Timestamp.from(autor.em()))
                .update();
    }
}
