package com.durvalcrm.estoque;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.doador.application.CepPort;
import com.durvalcrm.estoque.application.EntradaEstoqueUseCase;
import com.durvalcrm.estoque.domain.ItemEntrada;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Módulo Estoque (US-INVENTORY-001 a 016) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class EstoqueApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    static final class RelogioDeTeste extends Clock {
        private Instant agora = Instant.parse("2026-10-19T13:00:00Z");
        private final ZoneId zona = ZoneId.of("America/Sao_Paulo");

        void ajustar(String instante) { agora = Instant.parse(instante); }
        @Override public ZoneId getZone() { return zona; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return agora; }
    }

    @TestConfiguration
    static class Config {
        @Bean
        @Primary
        RelogioDeTeste relogioDeTeste() {
            return new RelogioDeTeste();
        }
    }

    @MockitoBean
    JwtDecoder jwtDecoder;

    @MockitoBean
    CepPort cep;

    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;
    @Autowired RelogioDeTeste relogio;
    @Autowired EventoAuditoriaRepository auditoria;
    @Autowired EntradaEstoqueUseCase entradas;

    long editora;
    long oCaminho;
    long cafe;
    long r1;
    long r2;

    private static List<GrantedAuthority> papeis(String... roles) {
        return Arrays.stream(roles).map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
    }

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(papeis(roles));
    }

    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");
    private static final JwtRequestPostProcessor OUTRO_VENDEDOR = usuario("Bia", "VENDEDOR");
    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR");
    private static final JwtRequestPostProcessor ADMIN_VENDEDOR = usuario("Eva", "ADMINISTRADOR", "VENDEDOR");
    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");

    @BeforeEach
    void preparar() {
        relogio.ajustar("2026-10-19T13:00:00Z");
        editora = jdbc.sql("insert into editora (nome) values ('Editora Luz') returning id").query(Long.class).single();
        oCaminho = jdbc.sql("""
                insert into produto (tipo, nome, autor, isbn, editora_id, preco, repasse_padrao)
                values ('LIVRO', 'O Caminho', 'André Luiz', '9788573287868', ?, 50.00, 35) returning id""")
                .param(editora).query(Long.class).single();
        cafe = jdbc.sql("insert into produto (tipo, nome, categoria, preco) values ('CANTINA', 'Café', 'Bebidas', 3.50) returning id")
                .query(Long.class).single();
        r1 = remessa("R-0001", "2026-09-01", 3, "40");
        r2 = remessa("R-0002", "2026-10-10", 5, "35");
        lote(cafe, null, 10);
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    private long remessa(String codigo, String recebidaEm, int quantidade, String percentual) {
        long id = jdbc.sql("insert into remessa (codigo, editora_id, recebida_em) values (?, ?, ?::date) returning id")
                .params(codigo, editora, recebidaEm).query(Long.class).single();
        jdbc.sql("insert into remessa_item (remessa_id, produto_id, quantidade_recebida, repasse_percentual) values (?, ?, ?, ?)")
                .params(id, oCaminho, quantidade, new BigDecimal(percentual)).update();
        lote(oCaminho, id, quantidade);
        return id;
    }

    private void lote(long produto, Long remessa, int quantidade) {
        jdbc.sql("insert into lote_estoque (produto_id, remessa_id, quantidade) values (?, ?, ?)")
                .params(produto, remessa, quantidade).update();
    }

    private int saldoLote(long produto, Long remessa) {
        return jdbc.sql("select coalesce(sum(quantidade), 0) from lote_estoque where produto_id = ? and remessa_id is not distinct from ?")
                .params(produto, remessa).query(Integer.class).single();
    }

    private void definirSaldo(long produto, Long remessa, int quantidade) {
        jdbc.sql("update lote_estoque set quantidade = ? where produto_id = ? and remessa_id is not distinct from ?")
                .params(quantidade, produto, remessa).update();
    }

    private int lancamentosFinanceiros() {
        return jdbc.sql("select count(*) from lancamento_financeiro").query(Integer.class).single();
    }

    private List<String> acoes(String entidade, Object id) {
        return auditoria.listarPorEntidade(entidade, String.valueOf(id)).stream().map(EventoAuditoria::acao).toList();
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, JwtRequestPostProcessor quem, Object corpo)
            throws Exception {
        return mvc.perform(req.with(quem).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)));
    }

    private JsonNode corpo(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put((String) pares[i], pares[i + 1]);
        }
        return m;
    }

    private long pedirBaixa(JwtRequestPostProcessor quem, long produto, Long remessa, int quantidade, String motivo)
            throws Exception {
        return corpo(enviar(post("/api/estoque/solicitacoes/baixa"), quem, mapa("produtoId", produto,
                "remessaId", remessa, "quantidade", quantidade, "motivo", motivo, "justificativa", "Capa rasgada"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    /** US-INVENTORY-001: o Vendedor (ou o Administrador) cadastra títulos; ISBN validado e único. */
    @Test
    void cadastraLivroComIsbnValidoEUnico() throws Exception {
        Map<String, Object> livro = mapa("titulo", "Nosso Lar", "autor", "André Luiz", "isbn", "978-85-7328-655-7",
                "editoraId", editora, "repassePadrao", 40, "preco", 45);
        enviar(post("/api/estoque/livros"), OPERADOR, livro).andExpect(status().isForbidden());
        long id = corpo(enviar(post("/api/estoque/livros"), ADMIN, livro)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isbn").value("9788573286557"))
                .andExpect(jsonPath("$.ativo").value(true))).get("id").asLong();

        enviar(post("/api/estoque/livros"), ADMIN, livro)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("isbn"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("Este ISBN já está cadastrado em outro título."));
        livro.put("isbn", "9788573286558");
        enviar(post("/api/estoque/livros"), ADMIN, livro)
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("isbn"));

        livro.put("isbn", "9788573286557");
        livro.put("titulo", "Nosso Lar (edição especial)");
        enviar(put("/api/estoque/livros/{id}", id), ADMIN, livro).andExpect(status().isOk());
        assertThat(acoes("PRODUTO", id)).containsExactly("PRODUTO_CADASTRADO", "PRODUTO_ALTERADO");

        // Sem movimento pode ser excluído; com movimento, só inativado.
        mvc.perform(delete("/api/estoque/produtos/{id}", id).with(ADMIN)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/estoque/produtos/{id}", oCaminho).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PRODUTO_COM_MOVIMENTOS"));
    }

    /** US-INVENTORY-002: cadastro da cantina com aviso de nome parecido; correção só sem movimentos. */
    @Test
    void cadastraProdutoDaCantinaECorrigeSoSemMovimentos() throws Exception {
        mvc.perform(get("/api/estoque/produtos/similares").param("nome", "cafe").param("tipo", "CANTINA").with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nome").value("Café"));
        mvc.perform(get("/api/estoque/produtos/similares").param("nome", "Café com leite").with(VENDEDOR))
                .andExpect(jsonPath("$[0].nome").value("Café"));

        long agua = corpo(enviar(post("/api/estoque/cantina"), VENDEDOR,
                mapa("nome", "Agua 500ml", "categoria", "Bebidas", "preco", "3.00"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ativo").value(true))).get("id").asLong();
        assertThat(saldoLote(agua, null)).isZero();

        enviar(put("/api/estoque/cantina/{id}", agua), VENDEDOR, mapa("nome", "Água 500ml", "categoria", "Bebidas"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Água 500ml"));

        enviar(post("/api/estoque/entradas-doacao"), VENDEDOR, mapa("itens", List.of(mapa("produtoId", agua,
                "quantidade", 12)))).andExpect(status().isCreated());
        enviar(put("/api/estoque/cantina/{id}", agua), VENDEDOR, mapa("nome", "Água mineral", "categoria", "Bebidas"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PRODUTO_COM_MOVIMENTOS"));
        enviar(put("/api/estoque/cantina/{id}", agua), ADMIN, mapa("nome", "Água mineral", "categoria", "Bebidas"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/estoque/opcoes").with(VENDEDOR))
                .andExpect(jsonPath("$.categorias", hasSize(3)))
                .andExpect(jsonPath("$.editoras[0].nome").value("Editora Luz"));
    }

    /** US-INVENTORY-006: a doação entra na hora como estoque próprio, sem lançamento; cancelamento estorna. */
    @Test
    void entradaPorDoacaoECancelamentoPeloAdministrador() throws Exception {
        long id = corpo(enviar(post("/api/estoque/entradas-doacao"), VENDEDOR, mapa("observacao", "Doação da Dona Maria",
                "itens", List.of(mapa("produtoId", oCaminho, "quantidade", 2), mapa("produtoId", cafe, "quantidade", 5))))
                .andExpect(status().isCreated())).get("id").asLong();

        assertThat(saldoLote(oCaminho, null)).isEqualTo(2);
        assertThat(saldoLote(cafe, null)).isEqualTo(15);
        assertThat(lancamentosFinanceiros()).isZero();
        mvc.perform(get("/api/estoque/produtos").with(OPERADOR)).andExpect(status().isForbidden());
        mvc.perform(get("/api/estoque/produtos").param("tipo", "LIVRO").with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].saldo").value(10))
                .andExpect(jsonPath("$[0].saldoProprio").value(2))
                .andExpect(jsonPath("$[0].saldoConsignado").value(8))
                .andExpect(jsonPath("$[0].ultimaEntrada").value("2026-10-19T13:00:00Z"));
        mvc.perform(get("/api/estoque/entradas-doacao").with(VENDEDOR))
                .andExpect(jsonPath("$[0].itens", hasSize(2)))
                .andExpect(jsonPath("$[0].cancelavel").value(true))
                .andExpect(jsonPath("$[0].registradaPorNome").value("Bruno"));

        enviar(post("/api/estoque/entradas-doacao/{id}/cancelamento", id), VENDEDOR, mapa("motivo", "erro"))
                .andExpect(status().isForbidden());
        definirSaldo(cafe, null, 4);
        enviar(post("/api/estoque/entradas-doacao/{id}/cancelamento", id), ADMIN, mapa("motivo", "Duplicada"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("UNIDADES_JA_SAIRAM"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("Restam só 4 de 5 unidades de Café no estoque próprio."));

        definirSaldo(cafe, null, 15);
        enviar(post("/api/estoque/entradas-doacao/{id}/cancelamento", id), ADMIN, mapa("motivo", "Duplicada"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cancelada").value(true));
        assertThat(saldoLote(oCaminho, null)).isZero();
        assertThat(saldoLote(cafe, null)).isEqualTo(10);
        assertThat(jdbc.sql("select count(*) from movimento_estoque where tipo = 'ESTORNO' and estorna_movimento_id is not null")
                .query(Integer.class).single()).isEqualTo(2);
        // Entrada estornada deixa de contar como "última entrada".
        mvc.perform(get("/api/estoque/produtos").param("tipo", "LIVRO").with(VENDEDOR))
                .andExpect(jsonPath("$[0].ultimaEntrada").doesNotExist());
        assertThat(acoes("ENTRADA_DOACAO", id)).containsExactly("ENTRADA_DOACAO_REGISTRADA", "ENTRADA_DOACAO_CANCELADA");
    }

    /** Exemplo da US-INVENTORY-008: 1 unidade danificada de R-0002 (35%) a R$ 50,00 gera obrigação de R$ 17,50. */
    @Test
    void baixaDeConsignadoDanificadoGeraObrigacaoSemReceita() throws Exception {
        enviar(post("/api/estoque/solicitacoes/baixa"), VENDEDOR, mapa("produtoId", oCaminho, "remessaId", r2,
                "quantidade", 6, "motivo", "DANO", "justificativa", "Molhou"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("quantidade"));

        byte[] foto = {(byte) 0x89, 'P', 'N', 'G'};
        long id = corpo(enviar(post("/api/estoque/solicitacoes/baixa"), VENDEDOR, mapa("produtoId", oCaminho,
                "remessaId", r2, "quantidade", 1, "motivo", "DANO", "justificativa", "Capa rasgada",
                "foto", mapa("conteudoBase64", Base64.getEncoder().encodeToString(foto), "tipo", "image/png")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDENTE"))).get("id").asLong();

        // Pendente: o estoque não muda e aparece "aguardando baixa".
        assertThat(saldoLote(oCaminho, r2)).isEqualTo(5);
        mvc.perform(get("/api/estoque/produtos/{id}", oCaminho).with(VENDEDOR))
                .andExpect(jsonPath("$.aguardandoBaixa").value(1))
                .andExpect(jsonPath("$.lotes[1].remessaCodigo").value("R-0002"))
                .andExpect(jsonPath("$.lotes[1].aguardandoBaixa").value(1));
        mvc.perform(get("/api/estoque/solicitacoes").param("status", "PENDENTE").with(ADMIN))
                .andExpect(jsonPath("$[0].produtoNome").value("O Caminho"))
                .andExpect(jsonPath("$[0].remessaCodigo").value("R-0002"))
                .andExpect(jsonPath("$[0].temFoto").value(true))
                .andExpect(jsonPath("$[0].solicitanteNome").value("Bruno"));
        mvc.perform(get("/api/estoque/solicitacoes/{id}/foto", id).with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(foto));
        mvc.perform(get("/api/estoque/solicitacoes/{id}/foto", id).with(OUTRO_VENDEDOR)).andExpect(status().isNotFound());

        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", id).with(VENDEDOR)).andExpect(status().isForbidden());
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", id).with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))
                .andExpect(jsonPath("$.autoAprovada").value(false));

        assertThat(saldoLote(oCaminho, r2)).isEqualTo(4);
        assertThat(jdbc.sql("select valor from obrigacao_editora where origem_tipo = 'BAIXA' and origem_id = ?")
                .param(id).query(BigDecimal.class).single()).isEqualByComparingTo("17.50");
        assertThat(lancamentosFinanceiros()).isZero();
        assertThat(jdbc.sql("select tipo from movimento_estoque where referencia_tipo = 'SOLICITACAO_ESTOQUE' and referencia_id = ?")
                .param(id).query(String.class).single()).isEqualTo("BAIXA_DANO");
        mvc.perform(get("/api/estoque/solicitacoes").param("minhas", "true").with(VENDEDOR))
                .andExpect(jsonPath("$[0].status").value("APROVADA"))
                .andExpect(jsonPath("$[0].decididaPorNome").value("Daniel"));
        assertThat(acoes("SOLICITACAO_ESTOQUE", id)).containsExactly("SOLICITACAO_CRIADA", "SOLICITACAO_APROVADA");
    }

    /** US-INVENTORY-008: aprovação bloqueada se o saldo caiu; baixa própria não gera obrigação; rejeição pede motivo. */
    @Test
    void aprovacaoBloqueadaSemSaldoERejeicaoComMotivo() throws Exception {
        long vencidos = pedirBaixa(VENDEDOR, cafe, null, 4, "VENCIMENTO");
        definirSaldo(cafe, null, 3);
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", vencidos).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SALDO_INSUFICIENTE"))
                .andExpect(jsonPath("$.mensagem").value(
                        "O saldo atual do lote é 3 e não cobre a baixa de 4. Rejeite ou peça uma nova solicitação."));
        assertThat(saldoLote(cafe, null)).isEqualTo(3);

        enviar(post("/api/estoque/solicitacoes/{id}/rejeicao", vencidos), ADMIN, mapa("motivo", " "))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/estoque/solicitacoes/{id}/rejeicao", vencidos), ADMIN, mapa("motivo", "Recontar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJEITADA"));

        long outro = pedirBaixa(VENDEDOR, cafe, null, 2, "EXTRAVIO");
        mvc.perform(post("/api/estoque/solicitacoes/{id}/cancelamento", outro).with(OUTRO_VENDEDOR))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SOLICITACAO_DE_OUTRO_USUARIO"));
        mvc.perform(post("/api/estoque/solicitacoes/{id}/cancelamento", outro).with(VENDEDOR))
                .andExpect(jsonPath("$.status").value("CANCELADA"));

        // Administrador que também é Vendedor aprova o próprio pedido: marcado na auditoria.
        long proprio = pedirBaixa(ADMIN_VENDEDOR, cafe, null, 1, "DANO");
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", proprio).with(ADMIN_VENDEDOR))
                .andExpect(jsonPath("$.autoAprovada").value(true));
        assertThat(saldoLote(cafe, null)).isEqualTo(2);
        assertThat(jdbc.sql("select count(*) from obrigacao_editora").query(Integer.class).single()).isZero();
        assertThat(auditoria.listarPorEntidade("SOLICITACAO_ESTOQUE", String.valueOf(proprio)).getLast().detalhes())
                .containsEntry("autoAprovada", true);
    }

    /** US-INVENTORY-011/012: um pedido de preço por vez; o preço muda só na aprovação e entra no histórico. */
    @Test
    void alteracaoDePrecoDaCantinaPorSolicitacao() throws Exception {
        long id = corpo(enviar(post("/api/estoque/solicitacoes/preco"), VENDEDOR, mapa("produtoId", cafe,
                "novoPreco", "4.20", "motivo", "Fornecedor reajustou")).andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/estoque/solicitacoes/preco"), VENDEDOR, mapa("produtoId", cafe, "novoPreco", "4.00",
                "motivo", "outro")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SOLICITACAO_PENDENTE_EXISTENTE"));
        enviar(post("/api/estoque/solicitacoes/preco"), VENDEDOR, mapa("produtoId", oCaminho, "novoPreco", "60",
                "motivo", "x")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SOMENTE_CANTINA"));

        mvc.perform(get("/api/estoque/solicitacoes/{id}", id).with(ADMIN))
                .andExpect(jsonPath("$.precoVigente").value(3.5))
                .andExpect(jsonPath("$.novoPreco").value(4.2))
                .andExpect(jsonPath("$.diferencaPercentual").value(20.0));
        mvc.perform(get("/api/estoque/produtos/{id}", cafe).with(VENDEDOR))
                .andExpect(jsonPath("$.preco").value(3.5))
                .andExpect(jsonPath("$.precoPendente").value(true));

        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", id).with(ADMIN)).andExpect(status().isOk());
        mvc.perform(get("/api/estoque/produtos/{id}", cafe).with(VENDEDOR))
                .andExpect(jsonPath("$.preco").value(4.2))
                .andExpect(jsonPath("$.historicoPrecos[0].precoAnterior").value(3.5))
                .andExpect(jsonPath("$.historicoPrecos[0].solicitadoPor").value("Bruno"))
                .andExpect(jsonPath("$.historicoPrecos[0].aprovadoPor").value("Daniel"));
        // A venda passa a usar o novo preço (o carrinho antigo recebe PRECO_ALTERADO).
        mvc.perform(get("/api/vendas/produtos").param("q", "cafe").with(VENDEDOR))
                .andExpect(jsonPath("$[0].preco").value(4.2));
    }

    /** US-INVENTORY-013: o Administrador muda o preço do livro direto; a cantina não usa este caminho. */
    @Test
    void precoDeLivroDiretoPeloAdministrador() throws Exception {
        enviar(post("/api/estoque/livros/{id}/preco", oCaminho), ADMIN, mapa("preco", "55", "motivo", "Reajuste"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preco").value(55.0));
        assertThat(jdbc.sql("select repasse_percentual from remessa_item where remessa_id = ?").param(r1)
                .query(BigDecimal.class).single()).isEqualByComparingTo("40");
        enviar(post("/api/estoque/livros/{id}/preco", cafe), ADMIN, mapa("preco", "5", "motivo", "x"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PRECO_POR_SOLICITACAO"));
        mvc.perform(get("/api/estoque/produtos/{id}", oCaminho).with(ADMIN))
                .andExpect(jsonPath("$.historicoPrecos", hasSize(1)))
                .andExpect(jsonPath("$.historicoPrecos[0].solicitadoPor").doesNotExist());
    }

    /** US-INVENTORY-014/015: inativação só sem saldo; o Administrador reativa direto. */
    @Test
    void inativacaoDaCantinaBloqueadaComSaldo() throws Exception {
        long id = corpo(enviar(post("/api/estoque/solicitacoes/inativacao"), VENDEDOR, mapa("produtoId", cafe,
                "motivo", "Não vendemos mais")).andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", id).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensagem").value("Dê baixa ou venda as 10 unidades restantes antes de inativar."));

        definirSaldo(cafe, null, 0);
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", id).with(ADMIN)).andExpect(status().isOk());
        mvc.perform(get("/api/estoque/produtos").param("tipo", "CANTINA").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/estoque/produtos").param("tipo", "CANTINA").param("situacao", "INATIVOS").with(VENDEDOR))
                .andExpect(jsonPath("$[0].ativo").value(false));
        mvc.perform(get("/api/vendas/produtos").param("q", "cafe").with(VENDEDOR)).andExpect(jsonPath("$", hasSize(0)));

        mvc.perform(post("/api/estoque/produtos/{id}/reativacao", cafe).with(ADMIN))
                .andExpect(jsonPath("$.ativo").value(true));
        // Livro com saldo pode ser inativado pelo Administrador (a tela avisa a quantidade).
        enviar(post("/api/estoque/produtos/{id}/inativacao", oCaminho), ADMIN, mapa("motivo", "Fora de catálogo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ativo").value(false));
    }

    /** US-INVENTORY-016 e 010: ajuste após contagem e histórico com saldo após cada movimento. */
    @Test
    void ajusteAposContagemEHistoricoDeMovimentos() throws Exception {
        relogio.ajustar("2026-10-18T13:00:00Z");
        enviar(post("/api/estoque/produtos/{id}/ajuste", cafe), ADMIN, mapa("quantidadeContada", 12,
                "motivo", "Contagem de sábado")).andExpect(status().isOk())
                .andExpect(jsonPath("$.diferenca").value(2))
                .andExpect(jsonPath("$.tipo").value("AJUSTE"));
        relogio.ajustar("2026-10-19T13:00:00Z");
        enviar(post("/api/estoque/produtos/{id}/ajuste", cafe), ADMIN, mapa("quantidadeContada", 12,
                "motivo", "x")).andExpect(status().isUnprocessableContent());

        // Diminuição em remessa consignada vira baixa por extravio, com obrigação (2 × 50 × 40% = 40).
        enviar(post("/api/estoque/produtos/{id}/ajuste", oCaminho), ADMIN, mapa("remessaId", r1,
                "quantidadeContada", 1, "motivo", "Contagem")).andExpect(status().isOk())
                .andExpect(jsonPath("$.tipo").value("BAIXA_EXTRAVIO"));
        assertThat(saldoLote(oCaminho, r1)).isEqualTo(1);
        assertThat(jdbc.sql("select valor from obrigacao_editora where origem_tipo = 'BAIXA'")
                .query(BigDecimal.class).single()).isEqualByComparingTo("40.00");
        enviar(post("/api/estoque/produtos/{id}/ajuste", oCaminho), VENDEDOR, mapa("quantidadeContada", 1,
                "motivo", "x")).andExpect(status().isForbidden());

        enviar(post("/api/estoque/entradas-doacao"), VENDEDOR, mapa("itens", List.of(mapa("produtoId", cafe,
                "quantidade", 3)))).andExpect(status().isCreated());
        mvc.perform(get("/api/estoque/produtos/{id}/movimentos", cafe).with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].tipo").value("ENTRADA_DOACAO"))
                .andExpect(jsonPath("$[0].saldoApos").value(15))
                .andExpect(jsonPath("$[0].usuarioNome").value("Bruno"))
                .andExpect(jsonPath("$[1].tipo").value("AJUSTE"))
                .andExpect(jsonPath("$[1].quantidade").value(2))
                .andExpect(jsonPath("$[1].saldoApos").value(12));
        mvc.perform(get("/api/estoque/produtos/{id}/movimentos", cafe).param("de", "2026-10-19").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(get("/api/estoque/produtos/{id}/movimentos", cafe).param("tipo", "AJUSTE").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].saldoApos").value(12));
        mvc.perform(get("/api/estoque/produtos/{id}/movimentos", oCaminho).with(VENDEDOR))
                .andExpect(jsonPath("$[0].tipo").value("BAIXA_EXTRAVIO"))
                .andExpect(jsonPath("$[0].remessaCodigo").value("R-0001"))
                .andExpect(jsonPath("$[0].saldoApos").value(6));
    }

    /** US-INVENTORY-009: filtros por categoria, busca por ISBN e "somente sem saldo". */
    @Test
    void filtrosDoEstoqueDisponivel() throws Exception {
        jdbc.sql("insert into produto (tipo, nome, categoria, preco) values ('CANTINA', 'Coxinha', 'Salgados', 7)").update();
        mvc.perform(get("/api/estoque/produtos").param("categoria", "salgados").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].saldo").value(0));
        mvc.perform(get("/api/estoque/produtos").param("somenteSemSaldo", "true").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nome").value("Coxinha"));
        mvc.perform(get("/api/estoque/produtos").param("q", "978-85-7328-786-8").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].editoraNome").value("Editora Luz"));
        mvc.perform(get("/api/estoque/produtos").param("q", "andre").with(VENDEDOR))
                .andExpect(jsonPath("$[0].nome").value("O Caminho"));
    }

    /** US-EXPENSE-006 usa esta API: recebimento de compra entra como estoque próprio, ligado à intenção. */
    @Test
    void recebimentoDeCompraPeloModuloDeIntencoes() {
        Jwt token = Jwt.withTokenValue("t").header("alg", "none").subject("sub-Bruno").claim("name", "Bruno").build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(token, papeis("VENDEDOR")));

        entradas.registrarCompra(42, List.of(new ItemEntrada(cafe, 24)));

        assertThat(saldoLote(cafe, null)).isEqualTo(34);
        assertThat(jdbc.sql("select referencia_tipo || ':' || referencia_id from movimento_estoque where tipo = 'ENTRADA_COMPRA'")
                .query(String.class).single()).isEqualTo("INTENCAO_GASTO:42");
    }
}
