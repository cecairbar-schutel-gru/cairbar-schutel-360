package com.durvalcrm.estoque.adapter.out.persistence;

import com.durvalcrm.estoque.domain.FotoSolicitacao;
import com.durvalcrm.estoque.domain.MotivoBaixa;
import com.durvalcrm.estoque.domain.Solicitacao;
import com.durvalcrm.estoque.domain.SolicitacaoRepository;
import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoSolicitacao;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class SolicitacaoJdbcAdapter implements SolicitacaoRepository {

    private final JdbcClient jdbc;

    SolicitacaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Solicitacao salvar(Solicitacao s) {
        if (s.getId() != null) {
            jdbc.sql("""
                    update solicitacao_estoque set status = :status, decidida_por = :por, decidida_por_nome = :nome,
                        decidida_em = :em, motivo_decisao = :motivo
                    where id = :id""")
                    .param("status", s.getStatus().name())
                    .param("por", s.getDecididaPor())
                    .param("nome", s.getDecididaPorNome())
                    .param("em", instante(s.getDecididaEm()))
                    .param("motivo", s.getMotivoDecisao())
                    .param("id", s.getId())
                    .update();
            return s;
        }
        long id;
        try {
            id = jdbc.sql("""
                    insert into solicitacao_estoque (tipo, produto_id, remessa_id, quantidade, motivo_baixa, preco_atual,
                        novo_preco, justificativa, foto, foto_tipo, status, solicitante, solicitante_nome, solicitada_em,
                        decidida_por, decidida_por_nome, decidida_em, motivo_decisao)
                    values (:tipo, :produto, :remessa, :quantidade, :motivoBaixa, :precoAtual, :novoPreco,
                        :justificativa, :foto, :fotoTipo, :status, :solicitante, :solicitanteNome, :solicitadaEm,
                        :por, :porNome, :em, :motivo)
                    returning id""")
                    .param("tipo", s.getTipo().name())
                    .param("produto", s.getProdutoId())
                    .param("remessa", s.getRemessaId())
                    .param("quantidade", s.getQuantidade())
                    .param("motivoBaixa", s.getMotivoBaixa() == null ? null : s.getMotivoBaixa().name())
                    .param("precoAtual", s.getPrecoAtual())
                    .param("novoPreco", s.getNovoPreco())
                    .param("justificativa", s.getJustificativa())
                    .param("foto", s.getFoto() == null ? null : s.getFoto().conteudo())
                    .param("fotoTipo", s.getFoto() == null ? null : s.getFoto().tipo())
                    .param("status", s.getStatus().name())
                    .param("solicitante", s.getSolicitante())
                    .param("solicitanteNome", s.getSolicitanteNome())
                    .param("solicitadaEm", Timestamp.from(s.getSolicitadaEm()))
                    .param("por", s.getDecididaPor())
                    .param("porNome", s.getDecididaPorNome())
                    .param("em", instante(s.getDecididaEm()))
                    .param("motivo", s.getMotivoDecisao())
                    .query(Long.class)
                    .single();
        } catch (DuplicateKeyException e) {
            throw new RegraDeNegocioException("SOLICITACAO_PENDENTE_EXISTENTE",
                    "Já existe um pedido pendente deste tipo para este produto.");
        }
        return obter(id).orElseThrow();
    }

    @Override
    public Optional<Solicitacao> obter(long id) {
        return jdbc.sql("select * from solicitacao_estoque where id = ?")
                .param(id)
                .query(SolicitacaoJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public int pendenteDeBaixa(long produtoId, Long remessaId) {
        return jdbc.sql("""
                select coalesce(sum(quantidade), 0) from solicitacao_estoque
                where tipo = 'BAIXA' and status = 'PENDENTE' and produto_id = :produto
                  and remessa_id is not distinct from cast(:remessa as bigint)""")
                .param("produto", produtoId)
                .param("remessa", remessaId)
                .query(Integer.class)
                .single();
    }

    @Override
    public boolean existePendente(long produtoId, TipoSolicitacao tipo) {
        return jdbc.sql("""
                select exists (select 1 from solicitacao_estoque
                               where produto_id = ? and tipo = ? and status = 'PENDENTE')""")
                .params(produtoId, tipo.name())
                .query(Boolean.class)
                .single();
    }

    private static Timestamp instante(Instant i) {
        return i == null ? null : Timestamp.from(i);
    }

    private static Solicitacao mapear(ResultSet rs, int linha) throws SQLException {
        byte[] foto = rs.getBytes("foto");
        String motivo = rs.getString("motivo_baixa");
        Timestamp decidida = rs.getTimestamp("decidida_em");
        return Solicitacao.reconstituir(rs.getLong("id"), TipoSolicitacao.valueOf(rs.getString("tipo")),
                rs.getLong("produto_id"), rs.getObject("remessa_id", Long.class),
                rs.getObject("quantidade", Integer.class), motivo == null ? null : MotivoBaixa.valueOf(motivo),
                rs.getBigDecimal("preco_atual"), rs.getBigDecimal("novo_preco"), rs.getString("justificativa"),
                foto == null ? null : new FotoSolicitacao(foto, rs.getString("foto_tipo")),
                StatusSolicitacao.valueOf(rs.getString("status")), rs.getString("solicitante"),
                rs.getString("solicitante_nome"), rs.getTimestamp("solicitada_em").toInstant(),
                rs.getString("decidida_por"), rs.getString("decidida_por_nome"),
                decidida == null ? null : decidida.toInstant(), rs.getString("motivo_decisao"));
    }
}
