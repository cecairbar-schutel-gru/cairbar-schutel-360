package com.durvalcrm.intencaogasto.adapter.out.persistence;

import com.durvalcrm.intencaogasto.application.ConsultaIntencoesPort;
import com.durvalcrm.intencaogasto.domain.AnexoIntencao;
import com.durvalcrm.intencaogasto.domain.EventoIntencao;
import com.durvalcrm.intencaogasto.domain.StatusIntencao;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class ConsultaIntencoesJdbcAdapter implements ConsultaIntencoesPort {

    private final JdbcClient jdbc;

    ConsultaIntencoesJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<ResumoIntencao> listar(List<StatusIntencao> status, String solicitante, boolean maisAntigasPrimeiro) {
        StringBuilder sql = new StringBuilder("""
                select i.id, i.criada_em, i.solicitante, i.solicitante_nome, i.descricao, i.categoria_codigo,
                       coalesce(p.nome || ' › ', '') || c.nome as categoria_nome, i.valor_solicitado,
                       i.valor_aprovado, i.status, i.status_alterado_em,
                       (select count(*) from intencao_gasto_anexo a where a.intencao_id = i.id) as anexos
                from intencao_gasto i
                join categoria_financeira c on c.codigo = i.categoria_codigo
                left join categoria_financeira p on p.codigo = c.categoria_pai
                where 1 = 1""");
        Map<String, Object> params = new LinkedHashMap<>();
        if (!status.isEmpty()) {
            sql.append(" and i.status in (:status)");
            params.put("status", status.stream().map(Enum::name).toList());
        }
        if (solicitante != null) {
            sql.append(" and i.solicitante = :solicitante");
            params.put("solicitante", solicitante);
        }
        sql.append(maisAntigasPrimeiro ? " order by i.criada_em, i.id" : " order by i.criada_em desc, i.id desc");
        sql.append(" limit 500");
        List<Linha> linhas = jdbc.sql(sql.toString()).params(params)
                .query((rs, n) -> new Linha(rs.getLong("id"), rs.getTimestamp("criada_em").toInstant(),
                        rs.getString("solicitante"), rs.getString("solicitante_nome"), rs.getString("descricao"),
                        rs.getString("categoria_codigo"), rs.getString("categoria_nome"),
                        rs.getBigDecimal("valor_solicitado"), rs.getBigDecimal("valor_aprovado"),
                        StatusIntencao.valueOf(rs.getString("status")), rs.getTimestamp("status_alterado_em").toInstant(),
                        rs.getInt("anexos")))
                .list();
        Map<Long, List<ItemResumo>> itens = itens(linhas.stream().map(Linha::id).toList());
        return linhas.stream().map(l -> new ResumoIntencao(l.id(), l.criadaEm(), l.solicitante(), l.solicitanteNome(),
                l.descricao(), l.categoria(), l.categoriaNome(), l.valorSolicitado(), l.valorAprovado(), l.status(),
                l.statusAlteradoEm(), l.anexos(), itens.getOrDefault(l.id(), List.of()))).toList();
    }

    private Map<Long, List<ItemResumo>> itens(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        record ItemDe(long intencao, ItemResumo item) {
        }
        return jdbc.sql("""
                select intencao_id, produto_id, produto_nome, quantidade, quantidade_recebida
                from intencao_gasto_item where intencao_id in (:ids) order by intencao_id, ordem""")
                .param("ids", ids)
                .query((rs, n) -> new ItemDe(rs.getLong("intencao_id"), new ItemResumo(rs.getLong("produto_id"),
                        rs.getString("produto_nome"), rs.getInt("quantidade"),
                        rs.getObject("quantidade_recebida", Integer.class))))
                .list().stream()
                .collect(Collectors.groupingBy(ItemDe::intencao, LinkedHashMap::new,
                        Collectors.mapping(ItemDe::item, Collectors.toCollection(ArrayList::new))));
    }

    @Override
    public List<EventoIntencao> historico(long intencaoId) {
        return jdbc.sql("""
                select evento, usuario, usuario_nome, em, descricao
                from intencao_gasto_historico where intencao_id = ? order by id""")
                .param(intencaoId)
                .query((rs, n) -> new EventoIntencao(EventoIntencao.TipoEvento.valueOf(rs.getString("evento")),
                        rs.getString("usuario"), rs.getString("usuario_nome"), rs.getTimestamp("em").toInstant(),
                        rs.getString("descricao")))
                .list();
    }

    @Override
    public List<InfoAnexo> anexos(long intencaoId) {
        return jdbc.sql("select ordem, nome, tipo, tamanho from intencao_gasto_anexo where intencao_id = ? order by ordem")
                .param(intencaoId)
                .query((rs, n) -> new InfoAnexo(rs.getInt("ordem"), rs.getString("nome"), rs.getString("tipo"),
                        rs.getInt("tamanho")))
                .list();
    }

    @Override
    public Optional<AnexoIntencao> anexo(long intencaoId, int ordem) {
        return jdbc.sql("select nome, tipo, conteudo from intencao_gasto_anexo where intencao_id = ? and ordem = ?")
                .params(intencaoId, ordem)
                .query((rs, n) -> new AnexoIntencao(rs.getString("nome"), rs.getString("tipo"), rs.getBytes("conteudo")))
                .optional();
    }

    @Override
    public long contar(StatusIntencao status) {
        return jdbc.sql("select count(*) from intencao_gasto where status = ?").param(status.name())
                .query(Long.class).single();
    }

    @Override
    public Optional<Instant> ultimaVisita(String usuario) {
        return jdbc.sql("select visto_em from intencao_gasto_visita where usuario = ?").param(usuario)
                .query((rs, n) -> rs.getTimestamp("visto_em").toInstant()).optional();
    }

    @Override
    public void registrarVisita(String usuario, Instant em) {
        jdbc.sql("""
                insert into intencao_gasto_visita (usuario, visto_em) values (?, ?)
                on conflict (usuario) do update set visto_em = excluded.visto_em""")
                .params(usuario, Timestamp.from(em))
                .update();
    }

    private record Linha(long id, Instant criadaEm, String solicitante, String solicitanteNome, String descricao,
            String categoria, String categoriaNome, java.math.BigDecimal valorSolicitado,
            java.math.BigDecimal valorAprovado, StatusIntencao status, Instant statusAlteradoEm, int anexos) {
    }
}
