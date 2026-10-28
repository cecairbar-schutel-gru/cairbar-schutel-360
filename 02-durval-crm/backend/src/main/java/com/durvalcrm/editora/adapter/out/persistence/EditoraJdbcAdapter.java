package com.durvalcrm.editora.adapter.out.persistence;

import com.durvalcrm.editora.domain.Editora;
import com.durvalcrm.editora.domain.EditoraRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
class EditoraJdbcAdapter implements EditoraRepository {

    private final JdbcClient jdbc;

    EditoraJdbcAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Editora> listarAtivas() {
        return jdbc.sql("select * from editora where ativa order by nome, id")
                .query(EditoraJdbcAdapter::mapear)
                .list();
    }

    @Override
    public Optional<Editora> obter(long id) {
        return jdbc.sql("select * from editora where id = ?").param(id).query(EditoraJdbcAdapter::mapear).optional();
    }

    @Override
    public Optional<Editora> travar(long id) {
        return jdbc.sql("select * from editora where id = ? for update").param(id).query(EditoraJdbcAdapter::mapear)
                .optional();
    }

    @Override
    public Editora salvar(Editora e) {
        String campos = """
                nome = :nome, cnpj = :cnpj, contato_nome = :contato, telefone = :telefone, email = :email,
                banco = :banco, agencia = :agencia, conta = :conta, chave_pix = :pix, observacoes = :obs, ativa = :ativa""";
        JdbcClient.StatementSpec sql;
        if (e.id() == null) {
            sql = jdbc.sql("""
                    insert into editora (nome, cnpj, contato_nome, telefone, email, banco, agencia, conta, chave_pix,
                        observacoes, ativa)
                    values (:nome, :cnpj, :contato, :telefone, :email, :banco, :agencia, :conta, :pix, :obs, :ativa)
                    returning id""");
        } else {
            sql = jdbc.sql("update editora set " + campos + " where id = :id returning id").param("id", e.id());
        }
        long id = sql.param("nome", e.nome())
                .param("cnpj", e.cnpj())
                .param("contato", e.contatoNome())
                .param("telefone", e.telefone())
                .param("email", e.email())
                .param("banco", e.pagamento().banco())
                .param("agencia", e.pagamento().agencia())
                .param("conta", e.pagamento().conta())
                .param("pix", e.pagamento().chavePix())
                .param("obs", e.observacoes())
                .param("ativa", e.ativa())
                .query(Long.class)
                .single();
        return new Editora(id, e.nome(), e.cnpj(), e.contatoNome(), e.telefone(), e.email(), e.pagamento(),
                e.observacoes(), e.ativa());
    }

    @Override
    public boolean cnpjEmUso(String cnpj, Long excetoId) {
        return jdbc.sql("select exists (select 1 from editora where cnpj = ? and id is distinct from ?)")
                .params(cnpj, excetoId)
                .query(Boolean.class)
                .single();
    }

    @Override
    public boolean possuiRemessas(long id) {
        return jdbc.sql("select exists (select 1 from remessa where editora_id = ?)").param(id).query(Boolean.class)
                .single();
    }

    @Override
    public void excluir(long id) {
        jdbc.sql("delete from editora where id = ?").param(id).update();
    }

    private static Editora mapear(ResultSet rs, int linha) throws SQLException {
        return new Editora(rs.getLong("id"), rs.getString("nome"), rs.getString("cnpj"), rs.getString("contato_nome"),
                rs.getString("telefone"), rs.getString("email"), new Editora.DadosPagamento(rs.getString("banco"),
                        rs.getString("agencia"), rs.getString("conta"), rs.getString("chave_pix")),
                rs.getString("observacoes"), rs.getBoolean("ativa"));
    }
}
