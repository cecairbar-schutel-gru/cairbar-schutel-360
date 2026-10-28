package com.durvalcrm.contapagar.adapter.out.persistence;

import com.durvalcrm.contapagar.domain.ContaPagar;
import com.durvalcrm.contapagar.domain.ContaPagarRepository;
import com.durvalcrm.contapagar.domain.Recorrencia;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ContaPagarJdbcAdapter implements ContaPagarRepository {

    private final JdbcClient jdbc;

    ContaPagarJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ContaPagar> listar() {
        return jdbc.sql("select * from conta_pagar order by lower(descricao), id").query(ContaPagarJdbcAdapter::mapear)
                .list();
    }

    @Override
    public Optional<ContaPagar> obter(long id) {
        return jdbc.sql("select * from conta_pagar where id = ?").param(id).query(ContaPagarJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public Optional<ContaPagar> travar(long id) {
        return jdbc.sql("select * from conta_pagar where id = ? for update").param(id)
                .query(ContaPagarJdbcAdapter::mapear).optional();
    }

    @Override
    public ContaPagar salvar(ContaPagar c) {
        JdbcClient.StatementSpec sql;
        if (c.id() == null) {
            sql = jdbc.sql("""
                    insert into conta_pagar (descricao, favorecido, categoria_codigo, valor_previsto, recorrencia,
                        primeiro_vencimento, fim_recorrencia, conta_financeira_id, observacoes, ativa)
                    values (:descricao, :favorecido, :categoria, :valor, :recorrencia, :primeiro, :fim, :conta, :obs,
                        :ativa)
                    returning id""");
        } else {
            sql = jdbc.sql("""
                    update conta_pagar set descricao = :descricao, favorecido = :favorecido,
                        categoria_codigo = :categoria, valor_previsto = :valor, recorrencia = :recorrencia,
                        primeiro_vencimento = :primeiro, fim_recorrencia = :fim, conta_financeira_id = :conta,
                        observacoes = :obs, ativa = :ativa
                    where id = :id returning id""").param("id", c.id());
        }
        long id = sql.param("descricao", c.descricao())
                .param("favorecido", c.favorecido())
                .param("categoria", c.categoria())
                .param("valor", c.valorPrevisto())
                .param("recorrencia", c.recorrencia().name())
                .param("primeiro", Date.valueOf(c.primeiroVencimento()))
                .param("fim", c.fimRecorrencia() == null ? null : Date.valueOf(c.fimRecorrencia()))
                .param("conta", c.contaFinanceiraId())
                .param("obs", c.observacoes())
                .param("ativa", c.ativa())
                .query(Long.class)
                .single();
        return new ContaPagar(id, c.descricao(), c.favorecido(), c.categoria(), c.valorPrevisto(), c.recorrencia(),
                c.primeiroVencimento(), c.fimRecorrencia(), c.contaFinanceiraId(), c.observacoes(), c.ativa());
    }

    @Override
    public void excluir(long id) {
        jdbc.sql("delete from conta_pagar where id = ?").param(id).update();
    }

    private static ContaPagar mapear(ResultSet rs, int linha) throws SQLException {
        Date fim = rs.getDate("fim_recorrencia");
        LocalDate fimRecorrencia = fim == null ? null : fim.toLocalDate();
        return new ContaPagar(rs.getLong("id"), rs.getString("descricao"), rs.getString("favorecido"),
                rs.getString("categoria_codigo"), rs.getBigDecimal("valor_previsto"),
                Recorrencia.valueOf(rs.getString("recorrencia")), rs.getDate("primeiro_vencimento").toLocalDate(),
                fimRecorrencia, rs.getObject("conta_financeira_id", Long.class), rs.getString("observacoes"),
                rs.getBoolean("ativa"));
    }
}
