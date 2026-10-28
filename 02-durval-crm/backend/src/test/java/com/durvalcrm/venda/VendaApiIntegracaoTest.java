package com.durvalcrm.venda;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.doador.application.CepPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.springframework.security.oauth2.jwt.JwtDecoder;
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

/** Jornada B (US-SALES-001 a 021) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class VendaApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    /** "Hoje" é 19/10/2026, como nos exemplos das histórias. */
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

    long caixa;
    long bancoA;
    long cartao;
    long editora;
    long oCaminho;
    long cafe;
    long paoDeQueijo;
    long inativo;
    long r1;
    long r2;

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        List<GrantedAuthority> authorities = Arrays.stream(roles)
                .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(authorities);
    }

    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");
    private static final JwtRequestPostProcessor OUTRO_VENDEDOR = usuario("Bia", "VENDEDOR");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");
    private static final JwtRequestPostProcessor PDV = usuario("Fábio", "PDV");

    @BeforeEach
    void preparar() {
        relogio.ajustar("2026-10-19T13:00:00Z");
        conta("cx-1", "Caixa Secretaria", "CAIXA");
        caixa = conta("cx-2", "Caixa Cantina", "CAIXA");
        bancoA = conta("banco-a", "Banco A", "BANCO");
        recebimento(caixa, bancoA);
        cartao = jdbc.sql("select id from conta_financeira where tipo = 'CARTAO_A_RECEBER'").query(Long.class).single();
        editora = jdbc.sql("insert into editora (nome) values ('Editora Luz') returning id").query(Long.class).single();

        oCaminho = produto("LIVRO", "O Caminho", null, "André Luiz", "9788573287868", "50.00", true);
        cafe = produto("CANTINA", "Café", "Bebidas", null, null, "3.50", true);
        paoDeQueijo = produto("CANTINA", "Pão de queijo", "Salgados", null, null, "5.00", true);
        inativo = produto("CANTINA", "Bolo antigo", "Doces", null, null, "4.00", false);
        // Exemplo da US-SALES-006: R-0001 (01/09, 40%) com 3 unidades e R-0002 (10/10, 35%) com 5.
        r1 = remessa("R-0001", "2026-09-01", oCaminho, 3, "40");
        r2 = remessa("R-0002", "2026-10-10", oCaminho, 5, "35");
        lote(cafe, null, 10);
        lote(inativo, null, 5);
    }

    private long conta(String codigo, String nome, String tipo) {
        return jdbc.sql("insert into conta_financeira (codigo, nome, tipo) values (?, ?, ?) returning id")
                .params(codigo, nome, tipo).query(Long.class).single();
    }

    /** Contas de recebimento definidas pelo Administrador: dinheiro e PIX. */
    private void recebimento(Long dinheiro, Long pix) {
        jdbc.sql("""
                insert into conta_recebimento (id, dinheiro_conta_id, pix_conta_id, atualizado_por, atualizado_em)
                values (1, ?, ?, 'teste', now())
                on conflict (id) do update set dinheiro_conta_id = excluded.dinheiro_conta_id,
                    pix_conta_id = excluded.pix_conta_id""")
                .params(dinheiro, pix).update();
    }

    private long produto(String tipo, String nome, String categoria, String autor, String isbn, String preco,
            boolean ativo) {
        return jdbc.sql("""
                insert into produto (tipo, nome, categoria, autor, isbn, editora_id, preco, ativo)
                values (?, ?, ?, ?, ?, ?, ?, ?) returning id""")
                .params(tipo, nome, categoria, autor, isbn, tipo.equals("LIVRO") ? editora : null, new BigDecimal(preco),
                        ativo)
                .query(Long.class).single();
    }

    private long remessa(String codigo, String recebidaEm, long produto, int quantidade, String percentual) {
        long id = jdbc.sql("insert into remessa (codigo, editora_id, recebida_em) values (?, ?, ?::date) returning id")
                .params(codigo, editora, recebidaEm).query(Long.class).single();
        jdbc.sql("insert into remessa_item (remessa_id, produto_id, quantidade_recebida, repasse_percentual) values (?, ?, ?, ?)")
                .params(id, produto, quantidade, new BigDecimal(percentual)).update();
        lote(produto, id, quantidade);
        return id;
    }

    private void lote(long produto, Long remessa, int quantidade) {
        jdbc.sql("insert into lote_estoque (produto_id, remessa_id, quantidade) values (?, ?, ?)")
                .params(produto, remessa, quantidade).update();
    }

    private int saldoLote(long produto, Long remessa) {
        return jdbc.sql("select quantidade from lote_estoque where produto_id = ? and remessa_id is not distinct from ?")
                .params(produto, remessa).query(Integer.class).single();
    }

    private BigDecimal saldo(long contaId) {
        return jdbc.sql("select coalesce(sum(valor), 0) from lancamento_linha_conta where conta_id = ?")
                .param(contaId).query(BigDecimal.class).single();
    }

    private Map<String, BigDecimal> receitas() {
        Map<String, BigDecimal> m = new LinkedHashMap<>();
        jdbc.sql("select categoria_codigo, sum(valor) from lancamento_linha_categoria group by 1")
                .query((rs, i) -> m.put(rs.getString(1), rs.getBigDecimal(2))).list();
        return m;
    }

    private List<String> acoes(Object id) {
        return auditoria.listarPorEntidade("VENDA", String.valueOf(id)).stream().map(EventoAuditoria::acao).toList();
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, JwtRequestPostProcessor quem, Object corpo)
            throws Exception {
        return mvc.perform(req.with(quem).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)));
    }

    private JsonNode corpo(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private static Map<String, Object> item(long produto, int quantidade, String preco) {
        Map<String, Object> i = new LinkedHashMap<>();
        i.put("produtoId", produto);
        i.put("quantidade", quantidade);
        i.put("precoUnitario", new BigDecimal(preco));
        return i;
    }

    private static Map<String, Object> pagamento(String meio, String valor) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("meio", meio);
        p.put("valor", new BigDecimal(valor));
        if ("CARTAO".equals(meio)) {
            p.put("tipoCartao", "CREDITO");
        }
        return p;
    }

    private Map<String, Object> venda(List<Map<String, Object>> itens, List<Map<String, Object>> pagamentos) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("itens", itens);
        v.put("pagamentos", pagamentos);
        v.put("chaveIdempotencia", UUID.randomUUID().toString());
        return v;
    }

    private long vender(Map<String, Object> venda) throws Exception {
        return corpo(enviar(post("/api/vendas"), VENDEDOR, venda).andExpect(status().isCreated())).get("id").asLong();
    }

    /** Exemplo da US-SALES-006: 4 unidades saem 3 de R-0001 e 1 de R-0002, com as obrigações de cada remessa. */
    @Test
    void vendeConsignadoPorFifoCriandoObrigacoesPorRemessa() throws Exception {
        long id = corpo(enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(oCaminho, 4, "50.00")),
                List.of(pagamento("PIX", "150.00"), pagamento("CARTAO", "50.00"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numero").value(1))
                .andExpect(jsonPath("$.total").value(200.0))
                .andExpect(jsonPath("$.status").value("CONCLUIDA"))).get("id").asLong();

        assertThat(saldoLote(oCaminho, r1)).isZero();
        assertThat(saldoLote(oCaminho, r2)).isEqualTo(4);
        List<BigDecimal> obrigacoes = jdbc.sql("""
                select valor from obrigacao_editora where origem_tipo = 'VENDA' and origem_id = ? order by remessa_id""")
                .param(id).query(BigDecimal.class).list();
        assertThat(obrigacoes).usingElementComparator(BigDecimal::compareTo)
                .containsExactly(new BigDecimal("60.00"), new BigDecimal("17.50"));
        assertThat(receitas()).containsOnlyKeys("RECEITAS_VENDAS.LIVROS");
        assertThat(receitas().get("RECEITAS_VENDAS.LIVROS")).isEqualByComparingTo("200.00");
        assertThat(saldo(bancoA)).isEqualByComparingTo("150.00");
        assertThat(saldo(cartao)).isEqualByComparingTo("50.00");
        assertThat(jdbc.sql("select count(*) from movimento_estoque where tipo = 'VENDA' and referencia_id = ?")
                .param(id).query(Integer.class).single()).isEqualTo(2);
        assertThat(acoes(id)).containsExactly("VENDA_CONFIRMADA");

        mvc.perform(get("/api/vendas/{id}", id).with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vendedorNome").value("Bruno"))
                .andExpect(jsonPath("$.itens[0].precoUnitario").value(50.0))
                .andExpect(jsonPath("$.itens[0].lotes", hasSize(2)))
                .andExpect(jsonPath("$.itens[0].lotes[0].remessaCodigo").value("R-0001"))
                .andExpect(jsonPath("$.itens[0].lotes[0].quantidade").value(3))
                .andExpect(jsonPath("$.itens[0].lotes[0].repassePercentual").value(40.0))
                .andExpect(jsonPath("$.itens[0].lotes[0].valorObrigacao").value(60.0))
                .andExpect(jsonPath("$.itens[0].lotes[1].remessaCodigo").value("R-0002"))
                .andExpect(jsonPath("$.itens[0].lotes[1].valorObrigacao").value(17.5))
                .andExpect(jsonPath("$.organizacao.nome").isNotEmpty());
    }

    /** Roteiro de validação (Spec §9): um livro e dois produtos da cantina, em dinheiro, com comprovante. */
    @Test
    void vendeLivroECantinaNoMesmoCarrinhoComComprovante() throws Exception {
        lote(oCaminho, null, 2);
        mvc.perform(get("/api/vendas/opcoes").with(VENDEDOR))
                .andExpect(jsonPath("$.dinheiro.nome").value("Caixa Cantina"))
                .andExpect(jsonPath("$.pix.nome").value("Banco A"))
                .andExpect(jsonPath("$.cartaoAReceber.id").value(cartao));
        mvc.perform(get("/api/vendas/produtos").param("q", "andre luiz").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].nome").value("O Caminho"))
                .andExpect(jsonPath("$[0].disponivel").value(10));
        mvc.perform(get("/api/vendas/produtos").param("q", "978-8573287868").with(VENDEDOR))
                .andExpect(jsonPath("$[0].id").value(oCaminho));
        // Botões da cantina: todos os ativos, inclusive sem saldo; o inativo nunca aparece.
        mvc.perform(get("/api/vendas/produtos").param("tipo", "CANTINA").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].nome").value("Café"))
                .andExpect(jsonPath("$[1].nome").value("Pão de queijo"))
                .andExpect(jsonPath("$[1].disponivel").value(0));

        long id = vender(venda(List.of(item(oCaminho, 1, "50.00"), item(cafe, 2, "3.50")),
                List.of(pagamento("DINHEIRO", "57.00"))));

        // Estoque próprio sai antes do consignado; nada de obrigação.
        assertThat(saldoLote(oCaminho, null)).isEqualTo(1);
        assertThat(saldoLote(oCaminho, r1)).isEqualTo(3);
        assertThat(saldoLote(cafe, null)).isEqualTo(8);
        assertThat(jdbc.sql("select count(*) from obrigacao_editora").query(Integer.class).single()).isZero();
        assertThat(saldo(caixa)).isEqualByComparingTo("57.00");
        assertThat(receitas().get("RECEITAS_VENDAS.LIVROS")).isEqualByComparingTo("50.00");
        assertThat(receitas().get("RECEITAS_VENDAS.CANTINA")).isEqualByComparingTo("7.00");

        mvc.perform(get("/api/vendas/{id}/comprovante.pdf", id).param("layout", "TERMICA").with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"venda-1-80mm.pdf\""));

        mvc.perform(get("/api/vendas/painel-vendedor").with(VENDEDOR))
                .andExpect(jsonPath("$.quantidade").value(1))
                .andExpect(jsonPath("$.totalDinheiro").value(57.0))
                .andExpect(jsonPath("$.cancelamentos").value(0));
    }

    @Test
    void semSaldoNadaEGravadoEOItemEDestacado() throws Exception {
        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(cafe, 2, "3.50"), item(oCaminho, 9, "50.00")),
                List.of(pagamento("DINHEIRO", "457.00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ESTOQUE_INSUFICIENTE"))
                .andExpect(jsonPath("$.erros", hasSize(1)))
                .andExpect(jsonPath("$.erros[0].campo").value("itens[" + oCaminho + "]"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("Só 8 disponíveis."));

        assertThat(jdbc.sql("select count(*) from venda").query(Integer.class).single()).isZero();
        assertThat(saldoLote(cafe, null)).isEqualTo(10);

        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(inativo, 1, "4.00")),
                List.of(pagamento("DINHEIRO", "4.00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PRODUTO_INATIVO"));
    }

    /** O perfil PDV só opera o PDV da cantina, onde vende os produtos da cantina e os livros cadastrados. */
    @Test
    void perfilPdvVendeCantinaELivros() throws Exception {
        mvc.perform(get("/api/vendas/opcoes").with(PDV))
                .andExpect(jsonPath("$.dinheiro.id").value(caixa));
        mvc.perform(get("/api/vendas/produtos").param("q", "andre luiz").with(PDV))
                .andExpect(jsonPath("$[0].nome").value("O Caminho"));
        mvc.perform(get("/api/vendas/produtos").param("tipo", "CANTINA").with(PDV))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].nome").value("Café"));

        enviar(post("/api/vendas"), PDV, venda(List.of(item(cafe, 1, "3.50"), item(oCaminho, 1, "50.00")),
                List.of(pagamento("DINHEIRO", "53.50"))))
                .andExpect(status().isCreated());
        assertThat(saldo(caixa)).isEqualByComparingTo("53.50");

        mvc.perform(get("/api/vendas").with(PDV)).andExpect(status().isForbidden());
        mvc.perform(get("/api/vendas/ultima").with(PDV))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pdv").value(true))
                .andExpect(jsonPath("$.itens", hasSize(2)))
                .andExpect(jsonPath("$.total").value(53.5));
        mvc.perform(get("/api/vendas/painel-vendedor").with(PDV)).andExpect(status().isForbidden());
    }

    /**
     * As vendas do PDV da cantina entram no relatório de vendas e no painel de todo Vendedor; a lista e o
     * cancelamento continuam só com as vendas que ele fez.
     */
    @Test
    void vendasDoPdvEntramNoRelatorioENoPainelDoVendedor() throws Exception {
        long minha = vender(venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50"))));
        long doPdv = corpo(enviar(post("/api/vendas"), PDV, venda(List.of(item(cafe, 2, "3.50")),
                List.of(pagamento("PIX", "7.00")))).andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/vendas"), OUTRO_VENDEDOR, venda(List.of(item(cafe, 1, "3.50")),
                List.of(pagamento("DINHEIRO", "3.50")))).andExpect(status().isCreated());
        assertThat(jdbc.sql("select pdv from venda where id = ?").param(doPdv).query(Boolean.class).single()).isTrue();
        assertThat(jdbc.sql("select pdv from venda where id = ?").param(minha).query(Boolean.class).single()).isFalse();

        mvc.perform(get("/api/vendas/painel-vendedor").with(VENDEDOR))
                .andExpect(jsonPath("$.quantidade").value(2))
                .andExpect(jsonPath("$.totalDinheiro").value(3.5))
                .andExpect(jsonPath("$.totalPix").value(7.0));
        mvc.perform(get("/api/relatorios/vendas").param("de", "2026-10-19").param("ate", "2026-10-19").with(VENDEDOR))
                .andExpect(jsonPath("$.vendas").value(2))
                .andExpect(jsonPath("$.receitaLiquida").value(10.5))
                .andExpect(jsonPath("$.cantina").value(10.5))
                .andExpect(jsonPath("$.porVendedor", hasSize(2)))
                .andExpect(jsonPath("$.porVendedor[?(@.nome == 'Fábio')].liquido").value(contains(7.0)));
        mvc.perform(get("/api/relatorios/vendas").param("de", "2026-10-19").param("ate", "2026-10-19").with(TESOUREIRO))
                .andExpect(jsonPath("$.vendas").value(3));

        mvc.perform(get("/api/vendas").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(minha))
                .andExpect(jsonPath("$[0].pdv").value(false));
        mvc.perform(get("/api/vendas").param("pdv", "true").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(doPdv))
                .andExpect(jsonPath("$[0].pdv").value(true));
        enviar(post("/api/vendas/{id}/cancelamento", doPdv), VENDEDOR, Map.of("motivo", "Venda feita no PDV"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_DE_OUTRO_VENDEDOR"));
    }

    /**
     * US-SALES-022: o PDV cancela a própria última venda a qualquer tempo e recebe 409 numa anterior; com a
     * última já cancelada, a anterior continua bloqueada. Estoque e financeiro são estornados.
     */
    @Test
    void pdvCancelaSoAPropriaUltimaVenda() throws Exception {
        mvc.perform(get("/api/vendas/ultima").with(PDV)).andExpect(status().isNoContent());
        long primeira = corpo(enviar(post("/api/vendas"), PDV, venda(List.of(item(cafe, 1, "3.50")),
                List.of(pagamento("DINHEIRO", "3.50")))).andExpect(status().isCreated())).get("id").asLong();
        long ultima = corpo(enviar(post("/api/vendas"), PDV, venda(List.of(item(cafe, 2, "3.50")),
                List.of(pagamento("DINHEIRO", "7.00")))).andExpect(status().isCreated())).get("id").asLong();
        // Sem prazo: o PDV cancela a última venda dias depois.
        relogio.ajustar("2026-10-30T13:00:00Z");

        enviar(post("/api/vendas/{id}/cancelamento", primeira), PDV, Map.of("motivo", "Cancelada no PDV"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("NAO_E_ULTIMA_VENDA_PDV"));
        enviar(post("/api/vendas/{id}/cancelamento", ultima), PDV, Map.of("motivo", "Cancelada no PDV"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADA"));
        assertThat(saldo(caixa)).isEqualByComparingTo("3.50");
        assertThat(saldoLote(cafe, null)).isEqualTo(9);
        mvc.perform(get("/api/vendas/ultima").with(PDV))
                .andExpect(jsonPath("$.id").value(ultima))
                .andExpect(jsonPath("$.status").value("CANCELADA"));
        enviar(post("/api/vendas/{id}/cancelamento", primeira), PDV, Map.of("motivo", "Cancelada no PDV"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("NAO_E_ULTIMA_VENDA_PDV"));
    }

    /** US-SALES-022: o Tesoureiro cancela as vendas do PDV, mas não as de um Vendedor. */
    @Test
    void tesoureiroCancelaVendaDoPdvMasNaoADeUmVendedor() throws Exception {
        long doVendedor = vender(venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50"))));
        long doPdv = corpo(enviar(post("/api/vendas"), PDV, venda(List.of(item(oCaminho, 1, "50.00")),
                List.of(pagamento("PIX", "50.00")))).andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/vendas"), PDV, venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50"))))
                .andExpect(status().isCreated());

        enviar(post("/api/vendas/{id}/cancelamento", doVendedor), TESOUREIRO, Map.of("motivo", "Venda de um Vendedor"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_DE_OUTRO_VENDEDOR"));
        enviar(post("/api/vendas/{id}/cancelamento", doPdv), TESOUREIRO, Map.of("motivo", "Venda acidental no PDV"))
                .andExpect(status().isOk());
        assertThat(saldo(bancoA)).isEqualByComparingTo("0.00");
        assertThat(saldoLote(oCaminho, r1)).isEqualTo(3);
        assertThat(jdbc.sql("select count(*) from obrigacao_editora where status <> 'ESTORNADA'").query(Integer.class)
                .single()).isZero();
        mvc.perform(get("/api/vendas/{id}", doPdv).with(TESOUREIRO))
                .andExpect(jsonPath("$.pdv").value(true))
                .andExpect(jsonPath("$.canceladaPor").value("Carla"));
    }

    /** O preço é o vigente na confirmação; se mudou depois de ir para o carrinho, nada é gravado. */
    @Test
    void precoAlteradoBloqueiaAConfirmacao() throws Exception {
        jdbc.sql("update produto set preco = 4.00 where id = ?").param(cafe).update();

        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(cafe, 1, "3.50")),
                List.of(pagamento("DINHEIRO", "3.50"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PRECO_ALTERADO"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("O preço de Café agora é R$ 4,00."));
    }

    @Test
    void pagamentosDevemFecharOTotalEAFormaPrecisaDeContaDeRecebimento() throws Exception {
        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(cafe, 2, "3.50")),
                List.of(pagamento("DINHEIRO", "10.00"))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value(
                        "Os pagamentos passam o total de R$ 7,00 em R$ 3,00. Registre só o valor da venda; o troco não entra."));

        // Sem conta de recebimento para o PIX, nada é gravado; dinheiro e cartão continuam aceitos.
        recebimento(caixa, null);
        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("PIX", "3.50"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_RECEBIMENTO_NAO_DEFINIDA"));
        assertThat(jdbc.sql("select count(*) from venda").query(Integer.class).single()).isZero();
        vender(venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50"))));

        enviar(post("/api/vendas"), OPERADOR, venda(List.of(item(cafe, 1, "3.50")),
                List.of(pagamento("DINHEIRO", "3.50"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void cliqueDuploNaoCriaDuasVendas() throws Exception {
        Map<String, Object> dados = venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50")));
        long primeira = vender(dados);
        long segunda = vender(dados);

        assertThat(segunda).isEqualTo(primeira);
        assertThat(saldoLote(cafe, null)).isEqualTo(9);
    }

    /** US-SALES-009 e 010: estorno completo, devolução às mesmas remessas e venda refeita com o preço atual. */
    @Test
    void cancelaDevolvendoAsMesmasRemessasERefazComPrecoAtual() throws Exception {
        long id = vender(venda(List.of(item(oCaminho, 4, "50.00"), item(cafe, 1, "3.50")),
                List.of(pagamento("DINHEIRO", "203.50"))));

        enviar(post("/api/vendas/{id}/cancelamento", id), VENDEDOR, Map.of("motivo", "curto"))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/vendas/{id}/cancelamento", id), VENDEDOR, Map.of("motivo", "Quantidade digitada errada"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADA"));

        assertThat(saldoLote(oCaminho, r1)).isEqualTo(3);
        assertThat(saldoLote(oCaminho, r2)).isEqualTo(5);
        assertThat(saldoLote(cafe, null)).isEqualTo(10);
        assertThat(jdbc.sql("select distinct status from obrigacao_editora").query(String.class).list())
                .containsExactly("ESTORNADA");
        assertThat(saldo(caixa)).isEqualByComparingTo("0");
        assertThat(receitas().get("RECEITAS_VENDAS.LIVROS")).isEqualByComparingTo("0");
        assertThat(jdbc.sql("select count(*) from lancamento_financeiro where estorna_lancamento_id is not null")
                .query(Integer.class).single()).isEqualTo(1);
        assertThat(acoes(id)).containsExactly("VENDA_CONFIRMADA", "VENDA_CANCELADA");
        enviar(post("/api/vendas/{id}/cancelamento", id), VENDEDOR, Map.of("motivo", "Quantidade digitada errada"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_JA_CANCELADA"));

        jdbc.sql("update produto set preco = 55.00 where id = ?").param(oCaminho).update();
        mvc.perform(get("/api/vendas/{id}/refazer", id).with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].quantidade").value(4))
                .andExpect(jsonPath("$.itens[0].precoAnterior").value(50.0))
                .andExpect(jsonPath("$.itens[0].precoAtual").value(55.0))
                .andExpect(jsonPath("$.itens[0].disponivel").value(8));

        Map<String, Object> refeita = venda(List.of(item(oCaminho, 2, "55.00")),
                List.of(pagamento("DINHEIRO", "110.00")));
        refeita.put("refazVendaId", id);
        long nova = vender(refeita);

        mvc.perform(get("/api/vendas/{id}", id).with(VENDEDOR))
                .andExpect(jsonPath("$.status").value("CANCELADA"))
                .andExpect(jsonPath("$.canceladaPor").value("Bruno"))
                .andExpect(jsonPath("$.motivoCancelamento").value("Quantidade digitada errada"))
                .andExpect(jsonPath("$.itens[0].precoUnitario").value(50.0))
                .andExpect(jsonPath("$.refeitaComo.id").value(nova))
                .andExpect(jsonPath("$.refeitaComo.numero").value(2));
        mvc.perform(get("/api/vendas/{id}", nova).with(VENDEDOR))
                .andExpect(jsonPath("$.refazVenda.numero").value(1));
        mvc.perform(get("/api/vendas/{id}/refazer", id).with(VENDEDOR))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_JA_REFEITA"));
        mvc.perform(get("/api/vendas/painel-vendedor").with(VENDEDOR))
                .andExpect(jsonPath("$.quantidade").value(1))
                .andExpect(jsonPath("$.cancelamentos").value(1));
    }

    /** Simulação de 27/10/2026, P9: o tipo do cartão é obrigatório e vai ao comprovante e ao Cartão a receber. */
    @Test
    void vendaNoCartaoGuardaCreditoOuDebito() throws Exception {
        Map<String, Object> semTipo = new LinkedHashMap<>(pagamento("CARTAO", "7.00"));
        semTipo.remove("tipoCartao");
        enviar(post("/api/vendas"), VENDEDOR, venda(List.of(item(cafe, 2, "3.50")), List.of(semTipo)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("tipoCartao"));

        Map<String, Object> debito = new LinkedHashMap<>(semTipo);
        debito.put("tipoCartao", "DEBITO");
        long id = vender(venda(List.of(item(cafe, 2, "3.50")), List.of(debito)));
        mvc.perform(get("/api/vendas/{id}", id).with(VENDEDOR))
                .andExpect(jsonPath("$.pagamentos[0].meio").value("CARTAO"))
                .andExpect(jsonPath("$.pagamentos[0].tipoCartao").value("DEBITO"));
        mvc.perform(get("/api/financeiro/cartao-a-receber").with(TESOUREIRO))
                .andExpect(jsonPath("$.debito").value(7.0))
                .andExpect(jsonPath("$.credito").value(0.0));

        // O estorno do cancelamento devolve o débito.
        enviar(post("/api/vendas/{id}/cancelamento", id), VENDEDOR, Map.of("motivo", "Cliente desistiu da compra"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/financeiro/cartao-a-receber").with(TESOUREIRO))
                .andExpect(jsonPath("$.debito").value(0.0));
    }

    @Test
    void cancelamentoBloqueadoQuandoOCartaoJaFoiLiquidado() throws Exception {
        long id = vender(venda(List.of(item(cafe, 2, "3.50")), List.of(pagamento("CARTAO", "7.00"))));
        // Liquidação (US-FINANCIAL-004): o bruto sai de Cartão a receber.
        long liquidacao = jdbc.sql("""
                insert into lancamento_financeiro (data_financeira, origem_tipo, natureza, descricao, criado_por, criado_em)
                values ('2026-10-19', 'LIQUIDACAO_CARTAO', 'LIQUIDACAO', 'Liquidação', 'teste', now()) returning id""")
                .query(Long.class).single();
        jdbc.sql("insert into lancamento_linha_conta (lancamento_id, ordem, conta_id, valor) values (?, 0, ?, -7.00)")
                .params(liquidacao, cartao).update();
        jdbc.sql("insert into lancamento_linha_conta (lancamento_id, ordem, conta_id, valor) values (?, 1, ?, 7.00)")
                .params(liquidacao, bancoA).update();

        enviar(post("/api/vendas/{id}/cancelamento", id), VENDEDOR, Map.of("motivo", "Cliente desistiu da compra"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CARTAO_JA_LIQUIDADO"));
    }

    /** US-SALES-011: o Vendedor vê só as vendas que fez; o Tesoureiro vê todas. */
    @Test
    void listaMostraAsVendasDoVendedorEFiltraPorStatusENumero() throws Exception {
        long minha = vender(venda(List.of(item(cafe, 1, "3.50")), List.of(pagamento("DINHEIRO", "3.50"))));
        long outra = corpo(enviar(post("/api/vendas"), OUTRO_VENDEDOR, venda(List.of(item(cafe, 1, "3.50")),
                List.of(pagamento("PIX", "3.50")))).andExpect(status().isCreated())).get("id").asLong();
        assertThat(saldo(bancoA)).isEqualByComparingTo("3.50");

        mvc.perform(get("/api/vendas").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(minha))
                .andExpect(jsonPath("$[0].meios[0]").value("DINHEIRO"));
        mvc.perform(get("/api/vendas").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(outra));
        mvc.perform(get("/api/vendas").param("numero", "2").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].vendedorNome").value("Bia"));
        mvc.perform(get("/api/vendas").param("status", "CANCELADA").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/vendas").param("de", "2026-10-18").param("ate", "2026-10-18").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/vendas/{id}", outra).with(VENDEDOR))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_DE_OUTRO_VENDEDOR"));
        enviar(post("/api/vendas/{id}/cancelamento", outra), VENDEDOR, Map.of("motivo", "Venda de outra pessoa"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENDA_DE_OUTRO_VENDEDOR"));
    }
}
