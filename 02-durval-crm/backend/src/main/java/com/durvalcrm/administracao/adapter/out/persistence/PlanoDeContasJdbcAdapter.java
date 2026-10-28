package com.durvalcrm.administracao.adapter.out.persistence;

import com.durvalcrm.administracao.domain.CategoriaPlano;
import com.durvalcrm.administracao.domain.PlanoDeContasRepository;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Cadastro do plano de contas ({@code categoria_financeira}, lido pelo Financeiro). "Em uso": linha de
 * lançamento, intenção de gasto (pedida ou aprovada), conta a pagar ou reclassificação com a categoria.
 */
@Component
class PlanoDeContasJdbcAdapter implements PlanoDeContasRepository {

    private static final String SELECT = """
            select c.codigo, c.nome, c.tipo, c.categoria_pai, c.sistema, c.ativa,
                   exists (select 1 from lancamento_linha_categoria l where l.categoria_codigo = c.codigo)
                   or exists (select 1 from intencao_gasto i
                              where i.categoria_codigo = c.codigo or i.categoria_aprovada = c.codigo)
                   or exists (select 1 from conta_pagar p where p.categoria_codigo = c.codigo)
                   or exists (select 1 from historico_classificacao h
                              where h.categoria_anterior = c.codigo or h.categoria_nova = c.codigo) as em_uso
            from categoria_financeira c""";

    private final JdbcClient jdbc;

    PlanoDeContasJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<CategoriaPlano> listar() {
        return jdbc.sql(SELECT).query(PlanoDeContasJdbcAdapter::mapear).list();
    }

    @Override
    public Optional<CategoriaPlano> buscar(String codigo) {
        return jdbc.sql(SELECT + " where c.codigo = ?").param(codigo).query(PlanoDeContasJdbcAdapter::mapear).optional();
    }

    @Override
    public void inserir(CategoriaPlano c) {
        jdbc.sql("insert into categoria_financeira (codigo, nome, tipo, categoria_pai, ativa, sistema) values (?, ?, ?, ?, ?, ?)")
                .params(c.codigo(), c.nome(), c.tipo().name(), c.categoriaPai(), c.ativa(), c.sistema())
                .update();
    }

    @Override
    public void atualizar(CategoriaPlano c) {
        jdbc.sql("update categoria_financeira set nome = ?, ativa = ? where codigo = ?")
                .params(c.nome(), c.ativa(), c.codigo()).update();
    }

    @Override
    public void excluir(String codigo) {
        jdbc.sql("delete from categoria_financeira where codigo = ?").param(codigo).update();
    }

    private static CategoriaPlano mapear(ResultSet rs, int i) throws SQLException {
        return new CategoriaPlano(rs.getString("codigo"), rs.getString("nome"), TipoCategoria.valueOf(rs.getString("tipo")),
                rs.getString("categoria_pai"), rs.getBoolean("sistema"), rs.getBoolean("ativa"), rs.getBoolean("em_uso"));
    }
}
