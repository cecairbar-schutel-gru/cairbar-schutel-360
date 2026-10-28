package com.durvalcrm.financeiro.adapter.out.persistence;

import com.durvalcrm.financeiro.domain.Categoria;
import com.durvalcrm.financeiro.domain.CategoriaRepository;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Leitura do plano de contas; o cadastro é da Administração (US-ADMIN-004). */
@Component
class CategoriaJdbcAdapter implements CategoriaRepository {

    private static final String SELECT = """
            select c.codigo, c.nome, c.tipo, c.categoria_pai, p.nome as nome_pai, c.ativa
            from categoria_financeira c left join categoria_financeira p on p.codigo = c.categoria_pai""";

    private final JdbcClient jdbc;

    CategoriaJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<Categoria> buscar(String codigo) {
        return jdbc.sql(SELECT + " where c.codigo = ?").param(codigo).query(CategoriaJdbcAdapter::mapear).optional();
    }

    @Override
    public List<Categoria> listar() {
        return jdbc.sql(SELECT + " order by c.tipo desc, coalesce(p.nome, c.nome), c.categoria_pai nulls first, c.nome")
                .query(CategoriaJdbcAdapter::mapear).list();
    }

    private static Categoria mapear(ResultSet rs, int i) throws SQLException {
        return new Categoria(rs.getString("codigo"), rs.getString("nome"), TipoCategoria.valueOf(rs.getString("tipo")),
                rs.getString("categoria_pai"), rs.getString("nome_pai"), rs.getBoolean("ativa"));
    }
}
