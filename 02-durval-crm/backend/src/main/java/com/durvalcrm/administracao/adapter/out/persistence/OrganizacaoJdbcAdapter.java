package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.ChavePix;
import com.durvalcrm.administracao.domain.Organizacao;
import com.durvalcrm.administracao.domain.OrganizacaoRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class OrganizacaoJdbcAdapter implements OrganizacaoRepository {

    private final JdbcClient jdbc;

    OrganizacaoJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Organizacao> buscar() {
        return jdbc.sql("select * from organizacao where id = 1").query(OrganizacaoJdbcAdapter::mapear).optional();
    }

    @Override
    public void salvar(Organizacao o) {
        jdbc.sql("""
                insert into organizacao (id, razao_social, nome_exibicao, cnpj, endereco, telefone, email, logo,
                    logo_tipo, rodape_recibo, tipo_chave_pix, chave_pix, cidade_pix, atualizado_por,
                    atualizado_por_nome, atualizado_em)
                values (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                on conflict (id) do update set razao_social = excluded.razao_social,
                    nome_exibicao = excluded.nome_exibicao, cnpj = excluded.cnpj, endereco = excluded.endereco,
                    telefone = excluded.telefone, email = excluded.email, logo = excluded.logo,
                    logo_tipo = excluded.logo_tipo, rodape_recibo = excluded.rodape_recibo,
                    tipo_chave_pix = excluded.tipo_chave_pix, chave_pix = excluded.chave_pix,
                    cidade_pix = excluded.cidade_pix,
                    atualizado_por = excluded.atualizado_por, atualizado_por_nome = excluded.atualizado_por_nome,
                    atualizado_em = excluded.atualizado_em""")
                .params(o.razaoSocial(), o.nomeExibicao(), o.cnpj(), o.endereco(), o.telefone(), o.email(),
                        o.logo() == null ? null : o.logo().conteudo(), o.logo() == null ? null : o.logo().tipo(),
                        o.rodapeRecibo(), o.pix() == null ? null : o.pix().tipo().name(),
                        o.pix() == null ? null : o.pix().chave(), o.pix() == null ? null : o.pix().cidade(),
                        o.atualizacao().subject(), o.atualizacao().nome(),
                        Timestamp.from(o.atualizacao().em()))
                .update();
    }

    private static Organizacao mapear(ResultSet rs, int i) throws SQLException {
        byte[] logo = rs.getBytes("logo");
        String tipoPix = rs.getString("tipo_chave_pix");
        return new Organizacao(rs.getString("razao_social"), rs.getString("nome_exibicao"), rs.getString("cnpj"),
                rs.getString("endereco"), rs.getString("telefone"), rs.getString("email"),
                logo == null ? null : new Organizacao.Logo(logo, rs.getString("logo_tipo")), rs.getString("rodape_recibo"),
                tipoPix == null ? null
                        : new ChavePix(ChavePix.Tipo.valueOf(tipoPix), rs.getString("chave_pix"), rs.getString("cidade_pix")),
                new Autor(rs.getString("atualizado_por"), rs.getString("atualizado_por_nome"),
                        rs.getTimestamp("atualizado_em").toInstant()));
    }
}
