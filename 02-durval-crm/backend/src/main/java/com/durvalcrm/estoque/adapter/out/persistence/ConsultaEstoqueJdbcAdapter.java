package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.application.ConsultaEstoquePort;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.application.FiltroEstoque;
import com.durvalcrm.estoque.application.ItemEstoque;
import com.durvalcrm.estoque.application.LoteDetalhado;
import com.durvalcrm.estoque.application.MovimentoComRemessa;
import com.durvalcrm.estoque.application.ProdutoSimilar;
import com.durvalcrm.estoque.application.ResumoEntradaDoacao;
import com.durvalcrm.estoque.application.ResumoSolicitacao;
import com.durvalcrm.estoque.domain.MotivoBaixa;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoProduto;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Leituras do Estoque montadas em SQL; lê também remessas e editoras, do mesmo banco. */
@Component
class ConsultaEstoqueJdbcAdapter implements ConsultaEstoquePort {

    /** Entradas que não foram estornadas contam como "última entrada". */
    private static final String ULTIMA_ENTRADA = """
            (select max(m.ocorrido_em) from movimento_estoque m
             where m.produto_id = p.id and m.tipo in ('ENTRADA_COMPRA', 'ENTRADA_DOACAO', 'ENTRADA_REMESSA')
               and not exists (select 1 from movimento_estoque x where x.estorna_movimento_id = m.id))""";

    private static final String SOLICITACOES = """
            select s.id, s.tipo, s.produto_id, p.nome as produto_nome, p.tipo as produto_tipo, s.remessa_id,
                   r.codigo as remessa_codigo, s.quantidade, s.motivo_baixa, s.justificativa, p.preco as preco_vigente,
                   s.novo_preco, s.foto is not null as tem_foto, s.status, s.solicitante, s.solicitante_nome,
                   s.solicitada_em, s.decidida_por, s.decidida_por_nome, s.decidida_em, s.motivo_decisao,
                   case when s.tipo = 'BAIXA'
                        then (select coalesce(sum(l.quantidade), 0) from lote_estoque l
                              where l.produto_id = s.produto_id and l.remessa_id is not distinct from s.remessa_id)
                        else (select coalesce(sum(l.quantidade), 0) from lote_estoque l where l.produto_id = s.produto_id)
                   end as saldo_atual,
                   (select max(m.ocorrido_em) from movimento_estoque m
                    where m.produto_id = s.produto_id and m.tipo = 'VENDA') as ultima_venda
            from solicitacao_estoque s
            join produto p on p.id = s.produto_id
            left join remessa r on r.id = s.remessa_id
            """;

    private final JdbcClient jdbc;

    ConsultaEstoqueJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ItemEstoque> listar(FiltroEstoque f) {
        return jdbc.sql("""
                select p.id, p.tipo, p.nome, p.categoria, p.autor, p.isbn, e.nome as editora_nome, p.preco, p.ativo,
                       coalesce(sum(l.quantidade), 0) as saldo,
                       coalesce(sum(l.quantidade) filter (where l.remessa_id is null), 0) as saldo_proprio,
                       coalesce(sum(l.quantidade) filter (where l.remessa_id is not null), 0) as saldo_consignado,
                       (select coalesce(sum(s.quantidade), 0) from solicitacao_estoque s
                        where s.produto_id = p.id and s.tipo = 'BAIXA' and s.status = 'PENDENTE') as aguardando,
                       """ + ULTIMA_ENTRADA + """
                        as ultima_entrada
                from produto p
                left join editora e on e.id = p.editora_id
                left join lote_estoque l on l.produto_id = p.id
                where (cast(:tipo as varchar) is null or p.tipo = :tipo)
                  and (cast(:categoria as varchar) is null or lower(p.categoria) = lower(:categoria))
                  and (:situacao = 'TODOS' or p.ativo = (:situacao = 'ATIVOS'))
                  and (p.texto_busca like '%' || :termo || '%' or p.isbn = cast(:isbn as varchar))
                group by p.id, e.nome
                having not :semSaldo or coalesce(sum(l.quantidade), 0) = 0
                order by p.nome, p.id""")
                .param("tipo", f.tipo() == null ? null : f.tipo().name())
                .param("categoria", f.categoria())
                .param("situacao", f.situacao().name())
                .param("termo", escapar(f.termoNormalizado()))
                .param("isbn", f.isbn())
                .param("semSaldo", f.somenteSemSaldo())
                .query((rs, i) -> new ItemEstoque(rs.getLong("id"), TipoProduto.valueOf(rs.getString("tipo")),
                        rs.getString("nome"), rs.getString("categoria"), rs.getString("autor"), rs.getString("isbn"),
                        rs.getString("editora_nome"), rs.getBigDecimal("preco"), rs.getBoolean("ativo"),
                        rs.getInt("saldo"), rs.getInt("saldo_proprio"), rs.getInt("saldo_consignado"),
                        rs.getInt("aguardando"), instante(rs.getTimestamp("ultima_entrada"))))
                .list();
    }

    @Override
    public List<LoteDetalhado> lotes(long produtoId) {
        return jdbc.sql("""
                select l.remessa_id, r.codigo, r.recebida_em, l.quantidade, i.repasse_percentual,
                       (select coalesce(sum(s.quantidade), 0) from solicitacao_estoque s
                        where s.produto_id = l.produto_id and s.remessa_id is not distinct from l.remessa_id
                          and s.tipo = 'BAIXA' and s.status = 'PENDENTE') as aguardando
                from lote_estoque l
                left join remessa r on r.id = l.remessa_id
                left join remessa_item i on i.remessa_id = l.remessa_id and i.produto_id = l.produto_id
                where l.produto_id = ?
                order by l.remessa_id is not null, r.recebida_em, r.codigo""")
                .param(produtoId)
                .query((rs, i) -> {
                    Date recebida = rs.getDate("recebida_em");
                    return new LoteDetalhado(rs.getObject("remessa_id", Long.class), rs.getString("codigo"),
                            recebida == null ? null : recebida.toLocalDate(), rs.getInt("quantidade"),
                            rs.getInt("aguardando"), rs.getBigDecimal("repasse_percentual"));
                })
                .list();
    }

    @Override
    public List<MovimentoComRemessa> movimentos(long produtoId) {
        return jdbc.sql("""
                select m.*, r.codigo as remessa_codigo
                from movimento_estoque m left join remessa r on r.id = m.remessa_id
                where m.produto_id = ? order by m.ocorrido_em, m.id""")
                .param(produtoId)
                .query((rs, i) -> new MovimentoComRemessa(EstoqueJdbcAdapter.movimento(rs, i),
                        rs.getString("remessa_codigo")))
                .list();
    }

    @Override
    public List<String> categoriasCantina() {
        return jdbc.sql("select distinct categoria from produto where tipo = 'CANTINA' and categoria is not null order by 1")
                .query(String.class)
                .list();
    }

    @Override
    public List<ProdutoSimilar> similares(String nomeNormalizado, TipoProduto tipo, Long excetoId) {
        return jdbc.sql("""
                select id, nome, categoria, ativo from produto
                where (cast(:tipo as varchar) is null or tipo = :tipo) and id is distinct from :exceto
                  and (texto_busca like '%' || :termo || '%' or :nome like '%' || trim(texto_busca) || '%'
                       or similarity(texto_busca, :nome) > 0.4)
                order by similarity(texto_busca, :nome) desc, nome
                limit 5""")
                .param("tipo", tipo == null ? null : tipo.name())
                .param("exceto", excetoId)
                .param("termo", escapar(nomeNormalizado))
                .param("nome", nomeNormalizado)
                .query((rs, i) -> new ProdutoSimilar(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getBoolean(4)))
                .list();
    }

    @Override
    public Optional<Instant> ultimaVenda(long produtoId) {
        return jdbc.sql("""
                select ocorrido_em from movimento_estoque where produto_id = ? and tipo = 'VENDA'
                order by ocorrido_em desc limit 1""")
                .param(produtoId)
                .query((rs, i) -> rs.getTimestamp(1).toInstant())
                .optional();
    }

    @Override
    public Optional<String> nomeEditora(Long editoraId) {
        if (editoraId == null) {
            return Optional.empty();
        }
        return jdbc.sql("select nome from editora where id = ?").param(editoraId).query(String.class).optional();
    }

    @Override
    public List<ResumoSolicitacao> solicitacoes(StatusSolicitacao status, String solicitante, int limite) {
        String ordem = status == StatusSolicitacao.PENDENTE ? "s.solicitada_em, s.id" : "s.solicitada_em desc, s.id desc";
        return jdbc.sql(SOLICITACOES + """
                where (cast(:status as varchar) is null or s.status = :status)
                  and (cast(:solicitante as varchar) is null or s.solicitante = :solicitante)
                order by\s""" + ordem + " limit :limite")
                .param("status", status == null ? null : status.name())
                .param("solicitante", solicitante)
                .param("limite", limite)
                .query(ConsultaEstoqueJdbcAdapter::solicitacao)
                .list();
    }

    @Override
    public Optional<ResumoSolicitacao> solicitacao(long id) {
        return jdbc.sql(SOLICITACOES + "where s.id = ?")
                .param(id)
                .query(ConsultaEstoqueJdbcAdapter::solicitacao)
                .optional();
    }

    @Override
    public List<ResumoEntradaDoacao> entradasDoacao(int limite) {
        Map<Long, List<ResumoEntradaDoacao.Item>> itens = new LinkedHashMap<>();
        Map<Long, Boolean> cancelavel = new LinkedHashMap<>();
        jdbc.sql("""
                select m.referencia_id, m.produto_id, p.nome, m.quantidade,
                       (select coalesce(sum(l.quantidade), 0) from lote_estoque l
                        where l.produto_id = m.produto_id and l.remessa_id is null) as proprio
                from movimento_estoque m join produto p on p.id = m.produto_id
                where m.referencia_tipo = :ref and m.tipo = 'ENTRADA_DOACAO'
                  and m.referencia_id in (select id from entrada_doacao order by registrada_em desc, id desc limit :limite)
                order by m.id""")
                .param("ref", EntradaEstoqueUseCase.REFERENCIA_DOACAO)
                .param("limite", limite)
                .query((rs, i) -> {
                    long entrada = rs.getLong(1);
                    itens.computeIfAbsent(entrada, k -> new ArrayList<>())
                            .add(new ResumoEntradaDoacao.Item(rs.getLong(2), rs.getString(3), rs.getInt(4)));
                    cancelavel.merge(entrada, rs.getInt(5) >= rs.getInt(4), Boolean::logicalAnd);
                    return entrada;
                })
                .list();
        return jdbc.sql("select * from entrada_doacao order by registrada_em desc, id desc limit ?")
                .param(limite)
                .query((rs, i) -> {
                    long id = rs.getLong("id");
                    Instant cancelada = instante(rs.getTimestamp("cancelada_em"));
                    return new ResumoEntradaDoacao(id, rs.getTimestamp("registrada_em").toInstant(),
                            rs.getString("registrada_por_nome"), rs.getString("observacao"),
                            itens.getOrDefault(id, List.of()), cancelada, rs.getString("cancelada_por_nome"),
                            rs.getString("motivo_cancelamento"), cancelada == null && cancelavel.getOrDefault(id, false));
                })
                .list();
    }

    private static ResumoSolicitacao solicitacao(ResultSet rs, int linha) throws SQLException {
        TipoSolicitacao tipo = TipoSolicitacao.valueOf(rs.getString("tipo"));
        BigDecimal vigente = rs.getBigDecimal("preco_vigente");
        BigDecimal novo = rs.getBigDecimal("novo_preco");
        BigDecimal diferenca = novo == null ? null : novo.subtract(vigente).multiply(BigDecimal.valueOf(100))
                .divide(vigente, 1, RoundingMode.HALF_UP);
        String motivo = rs.getString("motivo_baixa");
        StatusSolicitacao status = StatusSolicitacao.valueOf(rs.getString("status"));
        return new ResumoSolicitacao(rs.getLong("id"), tipo, rs.getLong("produto_id"), rs.getString("produto_nome"),
                TipoProduto.valueOf(rs.getString("produto_tipo")), rs.getObject("remessa_id", Long.class),
                rs.getString("remessa_codigo"), rs.getObject("quantidade", Integer.class),
                motivo == null ? null : MotivoBaixa.valueOf(motivo), rs.getString("justificativa"), vigente, novo,
                diferenca, rs.getBoolean("tem_foto"), status, rs.getString("solicitante_nome"),
                rs.getTimestamp("solicitada_em").toInstant(), rs.getString("decidida_por_nome"),
                instante(rs.getTimestamp("decidida_em")), rs.getString("motivo_decisao"),
                status == StatusSolicitacao.APROVADA && rs.getString("solicitante").equals(rs.getString("decidida_por")),
                rs.getInt("saldo_atual"), instante(rs.getTimestamp("ultima_venda")));
    }

    private static Instant instante(Timestamp t) {
        return t == null ? null : t.toInstant();
    }

    private static String escapar(String termo) {
        return termo.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
