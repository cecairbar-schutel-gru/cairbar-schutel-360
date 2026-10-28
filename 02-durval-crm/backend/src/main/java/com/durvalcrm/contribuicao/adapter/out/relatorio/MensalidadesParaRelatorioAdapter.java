package com.durvalcrm.contribuicao.adapter.out.relatorio;

import com.durvalcrm.relatorio.application.MensalidadesParaRelatorioPort;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Competências, mensalidades recebidas e doadores com pendências para o relatório (US-REPORT-004). */
@Component
class MensalidadesParaRelatorioAdapter implements MensalidadesParaRelatorioPort {

    private final JdbcClient jdbc;

    MensalidadesParaRelatorioAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<CompetenciasDoMes> competencias(YearMonth de, YearMonth ate) {
        return jdbc.sql("""
                select mes, count(*) as geradas,
                       count(*) filter (where status = 'PAGA') as pagas,
                       count(*) filter (where status = 'PENDENTE') as pendentes,
                       count(*) filter (where status = 'CANCELADA') as canceladas,
                       coalesce(sum(valor), 0) as valor_gerado,
                       coalesce(sum(valor) filter (where status = 'PAGA'), 0) as valor_pago,
                       coalesce(sum(valor) filter (where status = 'PENDENTE'), 0) as valor_pendente
                from competencia where mes between ? and ? group by mes order by mes""")
                .params(Date.valueOf(de.atDay(1)), Date.valueOf(ate.atDay(1)))
                .query((rs, i) -> new CompetenciasDoMes(YearMonth.from(rs.getDate("mes").toLocalDate()),
                        rs.getLong("geradas"), rs.getLong("pagas"), rs.getLong("pendentes"), rs.getLong("canceladas"),
                        rs.getBigDecimal("valor_gerado"), rs.getBigDecimal("valor_pago"), rs.getBigDecimal("valor_pendente")))
                .list();
    }

    @Override
    public List<MensalidadeRecebida> recebidas(LocalDate de, LocalDate ate) {
        // O cancelamento entra na data do estorno (que cai hoje quando o mês da contribuição está fechado).
        return jdbc.sql("""
                select c.data_financeira as data, cc.mes, cc.valor, false as estorno
                from contribuicao c join contribuicao_competencia cc on cc.contribuicao_id = c.id
                where c.data_financeira between :de and :ate
                union all
                select e.data_financeira, cc.mes, cc.valor, true
                from contribuicao c join contribuicao_competencia cc on cc.contribuicao_id = c.id
                join lancamento_financeiro e on e.estorna_lancamento_id = c.lancamento_id
                where c.status = 'CANCELADA' and e.data_financeira between :de and :ate
                order by 1, 2""")
                .param("de", Date.valueOf(de))
                .param("ate", Date.valueOf(ate))
                .query((rs, i) -> new MensalidadeRecebida(rs.getDate("data").toLocalDate(),
                        YearMonth.from(rs.getDate("mes").toLocalDate()), rs.getBigDecimal("valor"), rs.getBoolean("estorno")))
                .list();
    }

    @Override
    public List<DoadorComPendencias> doadoresComPendencias(int minimo, YearMonth ate) {
        return jdbc.sql("""
                select d.id, d.nome, count(*) as pendentes, sum(cp.valor) as valor_pendente,
                       (select max(pg.data_pagamento) from competencia pg
                        where pg.doador_id = d.id and pg.status = 'PAGA') as ultimo_pagamento
                from doador d
                join competencia cp on cp.doador_id = d.id and cp.status = 'PENDENTE' and cp.mes <= ?
                where d.status = 'ATIVO'
                group by d.id, d.nome having count(*) >= ?
                order by count(*) desc, sum(cp.valor) desc, d.nome""")
                .params(Date.valueOf(ate.atDay(1)), minimo)
                .query((rs, i) -> {
                    Date ultimo = rs.getDate("ultimo_pagamento");
                    return new DoadorComPendencias(rs.getLong("id"), rs.getString("nome"), rs.getLong("pendentes"),
                            rs.getBigDecimal("valor_pendente"), ultimo == null ? null : ultimo.toLocalDate());
                })
                .list();
    }
}
