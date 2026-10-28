package com.durvalcrm.intencaogasto.adapter.out.persistence;

import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.Aprovacao;
import com.durvalcrm.intencaogasto.domain.EventoIntencao;
import com.durvalcrm.intencaogasto.domain.IntencaoGasto;
import com.durvalcrm.intencaogasto.domain.IntencaoGastoRepository;
import com.durvalcrm.intencaogasto.domain.ItemCompra;
import com.durvalcrm.intencaogasto.domain.MeioPagamentoGasto;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
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
class IntencaoGastoJdbcAdapter implements IntencaoGastoRepository {

    private static final String SELECT = """
            select i.*, c.nome as categoria_aprovada_nome, p.nome as categoria_aprovada_pai
            from intencao_gasto i
            left join categoria_financeira c on c.codigo = i.categoria_aprovada
            left join categoria_financeira p on p.codigo = c.categoria_pai
            where i.id = ?""";

    private final JdbcClient jdbc;

    IntencaoGastoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public IntencaoGasto salvar(IntencaoGasto i) {
        long id = i.getId() == null ? inserir(i) : atualizar(i);
        jdbc.sql("delete from intencao_gasto_item where intencao_id = ?").param(id).update();
        int ordem = 0;
        for (ItemCompra item : i.getItens()) {
            jdbc.sql("""
                    insert into intencao_gasto_item (intencao_id, ordem, produto_id, produto_nome, quantidade,
                        quantidade_recebida)
                    values (?, ?, ?, ?, ?, ?)""")
                    .params(id, ordem++, item.produtoId(), item.produtoNome(), item.quantidade(),
                            item.quantidadeRecebida())
                    .update();
        }
        for (EventoIntencao e : i.getNovosEventos()) {
            jdbc.sql("""
                    insert into intencao_gasto_historico (intencao_id, evento, usuario, usuario_nome, em, descricao)
                    values (?, ?, ?, ?, ?, ?)""")
                    .params(id, e.tipo().name(), e.usuario(), e.usuarioNome(), Timestamp.from(e.em()), e.descricao())
                    .update();
        }
        return obter(id).orElseThrow();
    }

    private long inserir(IntencaoGasto i) {
        return jdbc.sql("""
                insert into intencao_gasto (descricao, categoria_codigo, valor_solicitado, justificativa, status,
                    solicitante, solicitante_nome, criada_em, status_alterado_em)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                returning id""")
                .params(i.getDescricao(), i.getCategoria(), i.getValorSolicitado(), i.getJustificativa(),
                        i.getStatus().name(), i.getSolicitante(), i.getSolicitanteNome(),
                        Timestamp.from(i.getCriadaEm()), Timestamp.from(i.getStatusAlteradoEm()))
                .query(Long.class)
                .single();
    }

    private long atualizar(IntencaoGasto i) {
        Aprovacao a = i.getAprovacao();
        jdbc.sql("""
                update intencao_gasto set status = :status, status_alterado_em = :alterado,
                    valor_aprovado = :valor, categoria_aprovada = :categoria, meio_pagamento = :meio,
                    conta_id = :conta, conta_nome = :contaNome, data_pagamento = :data, nota_aprovacao = :nota,
                    lancamento_id = :lancamento, decidida_por = :decididaPor, decidida_por_nome = :decididaNome,
                    decidida_em = :decididaEm, motivo_rejeicao = :rejeicao, recebida_por = :recebidaPor,
                    recebida_por_nome = :recebidaNome, recebida_em = :recebidaEm, divergencia = :divergencia,
                    cancelada_por = :canceladaPor, cancelada_por_nome = :canceladaNome, cancelada_em = :canceladaEm,
                    motivo_cancelamento = :cancelamento
                where id = :id""")
                .param("status", i.getStatus().name())
                .param("alterado", Timestamp.from(i.getStatusAlteradoEm()))
                .param("valor", a == null ? null : a.valor())
                .param("categoria", a == null ? null : a.categoria())
                .param("meio", a == null ? null : a.meio().name())
                .param("conta", a == null ? null : a.contaId())
                .param("contaNome", a == null ? null : a.contaNome())
                .param("data", a == null ? null : Date.valueOf(a.data()))
                .param("nota", a == null ? null : a.nota())
                .param("lancamento", a == null ? null : a.lancamentoId())
                .param("decididaPor", i.getDecididaPor())
                .param("decididaNome", i.getDecididaPorNome())
                .param("decididaEm", instante(i.getDecididaEm()))
                .param("rejeicao", i.getMotivoRejeicao())
                .param("recebidaPor", i.getRecebidaPor())
                .param("recebidaNome", i.getRecebidaPorNome())
                .param("recebidaEm", instante(i.getRecebidaEm()))
                .param("divergencia", i.getDivergencia())
                .param("canceladaPor", i.getCanceladaPor())
                .param("canceladaNome", i.getCanceladaPorNome())
                .param("canceladaEm", instante(i.getCanceladaEm()))
                .param("cancelamento", i.getMotivoCancelamento())
                .param("id", i.getId())
                .update();
        return i.getId();
    }

    @Override
    public Optional<IntencaoGasto> obter(long id) {
        return jdbc.sql(SELECT).param(id).query(this::mapear).optional();
    }

    @Override
    public Optional<IntencaoGasto> travar(long id) {
        jdbc.sql("select id from intencao_gasto where id = ? for update").param(id).query(Long.class).optional();
        return obter(id);
    }

    @Override
    public void salvarAnexos(long intencaoId, List<AnexoIntencao> anexos, Instant em) {
        int ordem = 1;
        for (AnexoIntencao a : anexos) {
            jdbc.sql("""
                    insert into intencao_gasto_anexo (intencao_id, ordem, nome, tipo, tamanho, conteudo, enviado_em)
                    values (?, ?, ?, ?, ?, ?, ?)""")
                    .params(intencaoId, ordem++, a.nome(), a.tipo(), a.conteudo().length, a.conteudo(), Timestamp.from(em))
                    .update();
        }
    }

    private List<ItemCompra> itens(long id) {
        return jdbc.sql("""
                select produto_id, produto_nome, quantidade, quantidade_recebida
                from intencao_gasto_item where intencao_id = ? order by ordem""")
                .param(id)
                .query((rs, n) -> new ItemCompra(rs.getLong("produto_id"), rs.getString("produto_nome"),
                        rs.getInt("quantidade"), rs.getObject("quantidade_recebida", Integer.class)))
                .list();
    }

    private IntencaoGasto mapear(ResultSet rs, int linha) throws SQLException {
        long id = rs.getLong("id");
        Aprovacao aprovacao = null;
        if (rs.getBigDecimal("valor_aprovado") != null) {
            String pai = rs.getString("categoria_aprovada_pai");
            String nome = rs.getString("categoria_aprovada_nome");
            aprovacao = new Aprovacao(rs.getBigDecimal("valor_aprovado"), rs.getString("categoria_aprovada"),
                    pai == null ? nome : pai + " › " + nome, MeioPagamentoGasto.valueOf(rs.getString("meio_pagamento")),
                    rs.getLong("conta_id"), rs.getString("conta_nome"), rs.getDate("data_pagamento").toLocalDate(),
                    rs.getString("nota_aprovacao"), rs.getObject("lancamento_id", Long.class));
        }
        return IntencaoGasto.reconstituir(id, rs.getString("descricao"), rs.getString("categoria_codigo"),
                rs.getBigDecimal("valor_solicitado"), rs.getString("justificativa"), itens(id),
                StatusIntencao.valueOf(rs.getString("status")), rs.getString("solicitante"),
                rs.getString("solicitante_nome"), rs.getTimestamp("criada_em").toInstant(),
                rs.getTimestamp("status_alterado_em").toInstant(), aprovacao, rs.getString("decidida_por"),
                rs.getString("decidida_por_nome"), instante(rs.getTimestamp("decidida_em")),
                rs.getString("motivo_rejeicao"), rs.getString("recebida_por"), rs.getString("recebida_por_nome"),
                instante(rs.getTimestamp("recebida_em")), rs.getString("divergencia"), rs.getString("cancelada_por"),
                rs.getString("cancelada_por_nome"), instante(rs.getTimestamp("cancelada_em")),
                rs.getString("motivo_cancelamento"));
    }

    private static Timestamp instante(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    private static Instant instante(Timestamp t) {
        return t == null ? null : t.toInstant();
    }
}
