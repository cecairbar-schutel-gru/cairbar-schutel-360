package com.durvalcrm.relatorio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
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
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
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

/** Relatórios (US-REPORT-001 a 009) e exportação (021) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class RelatorioApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    static final class RelogioDeTeste extends Clock {
        private Instant agora = Instant.parse("2026-10-20T13:00:00Z");
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

    long secretaria;
    long cantina;
    long banco;
    long cartao;
    long editora;
    long oCaminho;
    long cafe;

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        List<GrantedAuthority> authorities = Arrays.stream(roles)
                .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(authorities);
    }

    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");
    private static final JwtRequestPostProcessor OUTRO_VENDEDOR = usuario("Bia", "VENDEDOR");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR");

    @BeforeEach
    void preparar() {
        relogio.ajustar("2026-10-20T13:00:00Z");
        secretaria = conta("cx-1", "Caixa Secretaria", "CAIXA");
        cantina = conta("cx-2", "Caixa Cantina", "CAIXA");
        banco = conta("banco-a", "Banco A", "BANCO");
        cartao = jdbc.sql("select id from conta_financeira where tipo = 'CARTAO_A_RECEBER'").query(Long.class).single();
        editora = jdbc.sql("insert into editora (nome) values ('Editora Luz') returning id").query(Long.class).single();
        oCaminho = jdbc.sql("""
                insert into produto (tipo, nome, autor, editora_id, preco) values ('LIVRO', 'O Caminho', 'André Luiz', ?, 50.00)
                returning id""").param(editora).query(Long.class).single();
        cafe = jdbc.sql("insert into produto (tipo, nome, categoria, preco) values ('CANTINA', 'Café', 'Bebidas', 3.50) returning id")
                .query(Long.class).single();
        long remessa = jdbc.sql("insert into remessa (codigo, editora_id, recebida_em) values ('R-0001', ?, '2026-09-01') returning id")
                .param(editora).query(Long.class).single();
        jdbc.sql("insert into remessa_item (remessa_id, produto_id, quantidade_recebida, repasse_percentual) values (?, ?, 3, 40)")
                .params(remessa, oCaminho).update();
        jdbc.sql("insert into lote_estoque (produto_id, remessa_id, quantidade) values (?, ?, 3)").params(oCaminho, remessa).update();
        jdbc.sql("insert into lote_estoque (produto_id, remessa_id, quantidade) values (?, null, 30)").param(cafe).update();
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
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

    private long conta(String codigo, String nome, String tipo) {
        return jdbc.sql("insert into conta_financeira (codigo, nome, tipo) values (?, ?, ?) returning id")
                .params(codigo, nome, tipo).query(Long.class).single();
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

    private static Map<String, Object> pagamento(String meio, String valor) {
        return "CARTAO".equals(meio) ? mapa("meio", meio, "valor", new BigDecimal(valor), "tipoCartao", "CREDITO")
                : mapa("meio", meio, "valor", new BigDecimal(valor));
    }

    private long doador(String nome, String telefone, String... pendentes) throws Exception {
        long id = corpo(enviar(post("/api/doadores"), OPERADOR, mapa("nome", nome, "telefone", telefone, "email", "",
                "consentimentoWhatsapp", "SIM", "consentimentoEmail", "NAO_INFORMADO", "duplicatasDescartadas", List.of()))
                .andExpect(status().isCreated())).get("id").asLong();
        for (String mes : pendentes) {
            jdbc.sql("insert into competencia (doador_id, mes, valor, status) values (?, ?::date, 50.00, 'PENDENTE') on conflict do nothing")
                    .params(id, mes + "-01").update();
        }
        return id;
    }

    private long contribuir(long doador, List<String> meses, String doacao, List<Map<String, Object>> pagamentos)
            throws Exception {
        // O dinheiro das contribuições fica na secretaria e o das vendas, na cantina (o Administrador troca a conta).
        recebimento(secretaria, banco);
        return corpo(enviar(post("/api/contribuicoes"), OPERADOR, mapa("doadorId", doador, "anonima", false,
                "competencias", meses, "valorDoacao", new BigDecimal(doacao), "pagamentos", pagamentos,
                "chaveIdempotencia", UUID.randomUUID().toString())).andExpect(status().isCreated()))
                .get("id").asLong();
    }

    private long vender(long produto, int quantidade, String preco, Map<String, Object> pagamento) throws Exception {
        recebimento(cantina, banco);
        return corpo(enviar(post("/api/vendas"), VENDEDOR, mapa(
                "itens", List.of(mapa("produtoId", produto, "quantidade", quantidade, "precoUnitario", new BigDecimal(preco))),
                "pagamentos", List.of(pagamento), "chaveIdempotencia", UUID.randomUUID().toString()))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    /** Um mês de movimento real: contribuições, vendas, cancelamentos, liquidação, transferência, despesa e baixa. */
    private void movimentarOutubro() throws Exception {
        long maria = doador("Maria Souza", "11987654321", "2026-07", "2026-08", "2026-09", "2026-10");
        doador("José Lima", "21976543210", "2026-08", "2026-09", "2026-10");
        relogio.ajustar("2026-10-05T13:00:00Z");
        // Agosto (atrasada) e outubro (do mês) + R$ 20 de doação: R$ 70 em dinheiro e R$ 50 por PIX.
        contribuir(maria, List.of("2026-08", "2026-10"), "20.00",
                List.of(pagamento("DINHEIRO", "70.00"), pagamento("PIX", "50.00")));
        // Novembro antecipado, cancelado depois.
        long antecipada = contribuir(maria, List.of("2026-11"), "0", List.of(pagamento("DINHEIRO", "50.00")));
        enviar(post("/api/contribuicoes/{id}/cancelamento", antecipada), TESOUREIRO, mapa("motivo", "Registrada por engano"))
                .andExpect(status().isOk());

        vender(cafe, 2, "3.50", pagamento("DINHEIRO", "7.00"));
        vender(oCaminho, 1, "50.00", pagamento("CARTAO", "50.00"));
        long cancelada = vender(cafe, 1, "3.50", pagamento("DINHEIRO", "3.50"));
        enviar(post("/api/vendas/{id}/cancelamento", cancelada), VENDEDOR, mapa("motivo", "Quantidade digitada errada"))
                .andExpect(status().isOk());

        relogio.ajustar("2026-10-15T13:00:00Z");
        enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", banco, "data", "2026-10-15",
                "bruto", "50", "taxa", "2", "chaveIdempotencia", UUID.randomUUID().toString())).andExpect(status().isCreated());
        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", secretaria, "contaDestinoId", banco,
                "valor", "20", "data", "2026-10-15", "chaveIdempotencia", UUID.randomUUID().toString()))
                .andExpect(status().isCreated());
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", banco, "data", "2026-10-15", "tipo",
                "DESPESA", "categoria", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "valor", "30", "descricao", "Luz",
                "chaveIdempotencia", UUID.randomUUID().toString())).andExpect(status().isCreated());
        long baixa = corpo(enviar(post("/api/estoque/solicitacoes/baixa"), VENDEDOR, mapa("produtoId", cafe,
                "quantidade", 1, "motivo", "DANO", "justificativa", "Embalagem furada")).andExpect(status().isCreated()))
                .get("id").asLong();
        mvc.perform(post("/api/estoque/solicitacoes/{id}/aprovacao", baixa).with(ADMIN)).andExpect(status().isOk());
        relogio.ajustar("2026-10-20T13:00:00Z");
    }

    @Test
    void fluxoDeCaixaFechaComOsSaldosDasContas() throws Exception {
        movimentarOutubro();

        // US-REPORT-001: todas as contas. Entradas 100 + 20 + 50 + 7 = 177; saídas 30 + 2 = 32.
        mvc.perform(get("/api/relatorios/fluxo-caixa").param("de", "2026-10-01").param("ate", "2026-10-31")
                        .param("agrupamento", "SEMANA").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.saldoInicial").value(0))
                .andExpect(jsonPath("$.totalEntradas").value(177.0))
                .andExpect(jsonPath("$.totalSaidas").value(32.0))
                .andExpect(jsonPath("$.transferenciasEntrada").value(68.0))
                .andExpect(jsonPath("$.transferenciasSaida").value(68.0))
                .andExpect(jsonPath("$.saldoFinal").value(145.0))
                .andExpect(jsonPath("$.entradas[?(@.codigo == 'RECEITAS_CONTRIBUICOES')].valor").value(contains(120.0)))
                .andExpect(jsonPath("$.entradas[?(@.codigo == 'RECEITAS_VENDAS')].valor").value(contains(57.0)))
                .andExpect(jsonPath("$.saidas[?(@.codigo == 'DESPESAS_COMERCIAIS')].subcategorias[0].nome")
                        .value(contains("Taxas de cartão")))
                .andExpect(jsonPath("$.periodos", hasSize(5)))
                .andExpect(jsonPath("$.periodos[4].saldoFinal").value(145.0));
        BigDecimal saldos = jdbc.sql("""
                select coalesce(sum(lc.valor), 0) from lancamento_linha_conta lc
                join lancamento_financeiro l on l.id = lc.lancamento_id where l.data_financeira <= '2026-10-31'""")
                .query(BigDecimal.class).single();
        assertThat(saldos).isEqualByComparingTo("145");

        // Só Cartão a receber: a venda entra, a taxa sai e o líquido é transferência para o banco.
        mvc.perform(get("/api/relatorios/fluxo-caixa").param("de", "2026-10-01").param("ate", "2026-10-31")
                        .param("contaId", String.valueOf(cartao)).with(ADMIN))
                .andExpect(jsonPath("$.totalEntradas").value(50.0))
                .andExpect(jsonPath("$.totalSaidas").value(2.0))
                .andExpect(jsonPath("$.transferenciasSaida").value(48.0))
                .andExpect(jsonPath("$.saldoFinal").value(0.0))
                .andExpect(jsonPath("$.contas[0].nome").value("Cartão a receber"));
        mvc.perform(get("/api/relatorios/fluxo-caixa").param("tipoConta", "CAIXA").with(TESOUREIRO))
                .andExpect(jsonPath("$.contas", hasSize(2)))
                .andExpect(jsonPath("$.saldoFinal").value(57.0));
        mvc.perform(get("/api/relatorios/fluxo-caixa").with(OPERADOR)).andExpect(status().isForbidden());
        mvc.perform(get("/api/relatorios/fluxo-caixa").with(VENDEDOR)).andExpect(status().isForbidden());
        mvc.perform(get("/api/relatorios/fluxo-caixa").param("de", "2026-10-10").param("ate", "2026-10-01").with(TESOUREIRO))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("ate"));
    }

    @Test
    void receitasDespesasESaldosPorConta() throws Exception {
        movimentarOutubro();
        jdbc.sql("update categoria_financeira set ativa = false where codigo in "
                + "('DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA', 'OUTRAS_DESPESAS.EVENTOS')").update();

        // US-REPORT-002: plano ativo inteiro, mais a inativa que teve lançamento.
        mvc.perform(get("/api/relatorios/receitas-despesas").param("de", "2026-10-01").param("ate", "2026-10-31")
                        .with(TESOUREIRO))
                .andExpect(jsonPath("$.totalReceitas").value(177.0))
                .andExpect(jsonPath("$.totalDespesas").value(32.0))
                .andExpect(jsonPath("$.resultado").value(145.0))
                .andExpect(jsonPath("$.receitas[?(@.codigo == 'OUTRAS_RECEITAS')].valor").value(contains(0)))
                .andExpect(jsonPath("$.receitas[?(@.codigo == 'RECEITAS_VENDAS')].percentual").value(contains(32.2)))
                .andExpect(jsonPath("$.despesas[?(@.codigo == 'DESPESAS_OPERACIONAIS')].subcategorias[?(@.nome == 'Energia elétrica')].ativa")
                        .value(contains(false)))
                .andExpect(jsonPath("$.despesas[?(@.codigo == 'OUTRAS_DESPESAS')].subcategorias[*].nome")
                        .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Despesas com eventos"))));

        // US-REPORT-003: caixas e bancos são o disponível; Cartão a receber fica à parte.
        mvc.perform(get("/api/relatorios/saldos").param("de", "2026-10-01").param("ate", "2026-10-31").with(ADMIN))
                .andExpect(jsonPath("$.modo").value("PERIODO"))
                .andExpect(jsonPath("$.grupos[0].tipo").value("CAIXA"))
                .andExpect(jsonPath("$.grupos[0].totais.saldoFinal").value(57.0))
                .andExpect(jsonPath("$.grupos[1].contas[0].nome").value("Banco A"))
                .andExpect(jsonPath("$.grupos[1].contas[0].entradas").value(50.0))
                .andExpect(jsonPath("$.grupos[1].contas[0].saidas").value(30.0))
                .andExpect(jsonPath("$.grupos[1].contas[0].transferenciasEntrada").value(68.0))
                .andExpect(jsonPath("$.grupos[1].contas[0].saldoFinal").value(88.0))
                .andExpect(jsonPath("$.grupos[1].contas[0].conciliadaAte").isEmpty())
                .andExpect(jsonPath("$.totalDisponivel.saldoFinal").value(145.0))
                .andExpect(jsonPath("$.cartaoAReceber.saldoFinal").value(0.0))
                .andExpect(jsonPath("$.totalComRecebiveis").value(145.0));
        mvc.perform(get("/api/relatorios/saldos").param("data", "2026-10-10").with(TESOUREIRO))
                .andExpect(jsonPath("$.modo").value("DATA"))
                .andExpect(jsonPath("$.grupos[0].contas[0].saldoInicial").isEmpty())
                .andExpect(jsonPath("$.cartaoAReceber.saldoFinal").value(50.0))
                .andExpect(jsonPath("$.totalDisponivel.saldoFinal").value(127.0));
    }

    @Test
    void mensalidadesVendasEstoqueEEditoras() throws Exception {
        movimentarOutubro();

        // US-REPORT-004.
        mvc.perform(get("/api/relatorios/mensalidades").param("competenciaDe", "2026-08").param("competenciaAte", "2026-11")
                        .param("de", "2026-10-01").param("ate", "2026-10-31").with(TESOUREIRO))
                .andExpect(jsonPath("$.porCompetencia", hasSize(4)))
                .andExpect(jsonPath("$.porCompetencia[0].mes").value("2026-08"))
                .andExpect(jsonPath("$.porCompetencia[0].geradas").value(2))
                .andExpect(jsonPath("$.porCompetencia[0].pagas").value(1))
                .andExpect(jsonPath("$.porCompetencia[0].taxaPagamento").value(50.0))
                .andExpect(jsonPath("$.porCompetencia[3].mes").value("2026-11"))
                // O mês antecipado e cancelado deixa de existir (US-CONTRIB-009).
                .andExpect(jsonPath("$.porCompetencia[3].geradas").value(0))
                .andExpect(jsonPath("$.porCompetencia[3].taxaPagamento").isEmpty())
                .andExpect(jsonPath("$.recebimentos.atrasadas.valor").value(50.0))
                .andExpect(jsonPath("$.recebimentos.mesCorrente.valor").value(50.0))
                .andExpect(jsonPath("$.recebimentos.antecipadas.quantidade").value(0))
                .andExpect(jsonPath("$.recebimentos.antecipadas.valor").value(0.0))
                .andExpect(jsonPath("$.recebimentos.total.valor").value(100.0))
                .andExpect(jsonPath("$.doadoresComPendencias", hasSize(1)))
                .andExpect(jsonPath("$.doadoresComPendencias[0].nome").value("José Lima"))
                .andExpect(jsonPath("$.doadoresComPendencias[0].pendentes").value(3))
                .andExpect(jsonPath("$.doadoresComPendencias[0].valorPendente").value(150.0));

        // US-REPORT-006: o Vendedor vê só as vendas dele; o cancelamento sai da receita.
        mvc.perform(get("/api/relatorios/vendas").param("de", "2026-10-01").param("ate", "2026-10-31").with(VENDEDOR))
                .andExpect(jsonPath("$.vendas").value(3))
                .andExpect(jsonPath("$.receitaBruta").value(60.5))
                .andExpect(jsonPath("$.canceladas").value(1))
                .andExpect(jsonPath("$.valorCancelado").value(3.5))
                .andExpect(jsonPath("$.receitaLiquida").value(57.0))
                .andExpect(jsonPath("$.livros").value(50.0))
                .andExpect(jsonPath("$.cantina").value(7.0))
                .andExpect(jsonPath("$.porMeio[?(@.meio == 'CARTAO_CREDITO')].valor").value(contains(50.0)))
                .andExpect(jsonPath("$.porMeio[?(@.meio == 'DINHEIRO')].valor").value(contains(7.0)))
                .andExpect(jsonPath("$.porProduto[0].nome").value("O Caminho"))
                .andExpect(jsonPath("$.porProduto[1].quantidade").value(2))
                .andExpect(jsonPath("$.porVendedor[0].nome").value("Bruno"))
                .andExpect(jsonPath("$.porVendedor[0].liquido").value(57.0));
        mvc.perform(get("/api/relatorios/vendas").param("de", "2026-10-01").param("ate", "2026-10-31")
                        .with(OUTRO_VENDEDOR))
                .andExpect(jsonPath("$.vendas").value(0));
        mvc.perform(get("/api/relatorios/vendas").with(OPERADOR)).andExpect(status().isForbidden());

        // US-REPORT-007: saldos a partir da carga inicial; livro consignado por remessa.
        mvc.perform(get("/api/relatorios/estoque").param("de", "2026-10-01").param("ate", "2026-10-31").with(VENDEDOR))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'Café')].total.inicial").value(contains(30)))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'Café')].total.venda").value(contains(2)))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'Café')].total.baixa").value(contains(1)))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'Café')].total.fim").value(contains(27)))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'O Caminho')].origens[0].origem").value(contains("CONSIGNADO")))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'O Caminho')].origens[0].remessaCodigo").value(contains("R-0001")))
                .andExpect(jsonPath("$.produtos[?(@.nome == 'O Caminho')].total.fim").value(contains(2)))
                .andExpect(jsonPath("$.baixasPorMotivo[?(@.motivo == 'DANO')].quantidade").value(contains(1)));
        mvc.perform(get("/api/relatorios/estoque").param("de", "2026-09-01").param("ate", "2026-09-30")
                        .param("somenteComMovimento", "true").with(ADMIN))
                .andExpect(jsonPath("$.produtos", hasSize(0)));
        mvc.perform(get("/api/relatorios/estoque").param("tipo", "LIVRO").param("editoraId", String.valueOf(editora))
                        .with(ADMIN))
                .andExpect(jsonPath("$.produtos", hasSize(1)));
        mvc.perform(get("/api/relatorios/estoque/contagem").param("tipo", "CANTINA").with(VENDEDOR))
                .andExpect(jsonPath("$.itens", hasSize(1)))
                .andExpect(jsonPath("$.itens[0].quantidade").value(27));

        // US-REPORT-009: a venda consignada gerou R$ 20 de repasse (40%).
        mvc.perform(get("/api/relatorios/editoras").param("de", "2026-10-01").param("ate", "2026-10-31").with(TESOUREIRO))
                .andExpect(jsonPath("$.editoras", hasSize(1)))
                .andExpect(jsonPath("$.editoras[0].nome").value("Editora Luz"))
                .andExpect(jsonPath("$.editoras[0].saldoInicial").value(0))
                .andExpect(jsonPath("$.editoras[0].obrigacoesVendas").value(20.0))
                .andExpect(jsonPath("$.editoras[0].saldoFinal").value(20.0))
                .andExpect(jsonPath("$.total.saldoFinal").value(20.0));
        mvc.perform(get("/api/relatorios/editoras").with(VENDEDOR)).andExpect(status().isForbidden());
    }

    @Test
    void exportaComOsFiltrosDaTelaERegistraNaAuditoria() throws Exception {
        movimentarOutubro();

        mvc.perform(get("/api/relatorios/exportacoes/fluxo-caixa").param("formato", "PDF").param("de", "2026-10-01")
                        .param("ate", "2026-10-31").param("contaId", String.valueOf(banco)).with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition", containsString("fluxo-de-caixa-2026-10-01-a-2026-10-31.pdf")));
        byte[] planilha = mvc.perform(get("/api/relatorios/exportacoes/vendas").param("formato", "XLSX")
                        .param("de", "2026-10-01").param("ate", "2026-10-31").with(VENDEDOR))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("vendas-2026-10-01-a-2026-10-31.xlsx")))
                .andReturn().getResponse().getContentAsByteArray();
        String aba = aba(planilha, "xl/worksheets/sheet1.xml");
        assertThat(aba).contains("<v>60.50</v>", "<v>57.00</v>");

        // Receitas e despesas traz à parte o saldo devido hoje às editoras (R$ 20 da venda consignada).
        byte[] receitasDespesas = mvc.perform(get("/api/relatorios/exportacoes/receitas-despesas").param("formato", "XLSX")
                        .param("de", "2026-10-01").param("ate", "2026-10-31").with(TESOUREIRO))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(aba(receitasDespesas, "xl/worksheets/sheet3.xml")).contains("<v>145.00</v>");
        assertThat(aba(receitasDespesas, "xl/worksheets/sheet4.xml"))
                .contains("Devido às editoras (saldo atual)", "<v>20.00</v>", "Regime de caixa");
        for (String tipo : List.of("saldos", "mensalidades", "estoque", "contagem-estoque", "editoras")) {
            mvc.perform(get("/api/relatorios/exportacoes/" + tipo).param("formato", "XLSX").with(ADMIN))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/relatorios/exportacoes/demonstrativo").param("formato", "PDF").param("mes", "2026-10")
                .with(TESOUREIRO)).andExpect(status().isOk());
        mvc.perform(get("/api/relatorios/exportacoes/apuracao-editora").param("formato", "XLSX")
                .param("editoraId", String.valueOf(editora)).param("mes", "2026-10").with(TESOUREIRO))
                .andExpect(status().isOk());
        byte[] lancamentos = mvc.perform(get("/api/relatorios/exportacoes/lancamentos").param("formato", "XLSX")
                        .param("contaId", String.valueOf(banco)).param("de", "2026-10-01").param("ate", "2026-10-31")
                        .with(TESOUREIRO))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(aba(lancamentos, "xl/worksheets/sheet1.xml")).contains("Conta: Banco A", "Luz", "<v>88.00</v>");

        mvc.perform(get("/api/relatorios/exportacoes/vendas").param("formato", "DOC").with(VENDEDOR))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("formato"));
        mvc.perform(get("/api/relatorios/exportacoes/lancamentos").param("formato", "PDF").with(VENDEDOR))
                .andExpect(status().isForbidden());

        List<EventoAuditoria> eventos = auditoria.listarPorEntidade("Relatorio", "FLUXO_CAIXA");
        assertThat(eventos).hasSize(1);
        assertThat(eventos.get(0).acao()).isEqualTo("RELATORIO_EXPORTADO");
        assertThat(eventos.get(0).autorNome()).isEqualTo("Carla");
        assertThat(String.valueOf(eventos.get(0).detalhes())).contains("PDF", "Banco A");
        assertThat(auditoria.listarPorEntidade("Relatorio", "VENDAS")).hasSize(1);
    }

    private static String aba(byte[] xlsx, String nome) throws Exception {
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(xlsx))) {
            ZipEntry e;
            while ((e = in.getNextEntry()) != null) {
                if (e.getName().equals(nome)) {
                    return new String(in.readAllBytes(), StandardCharsets.UTF_8);
                }
            }
        }
        throw new AssertionError("Parte não encontrada: " + nome);
    }
}
