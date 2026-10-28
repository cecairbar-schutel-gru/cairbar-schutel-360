package com.durvalcrm.contribuicao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.contribuicao.application.GerarCompetenciasMensaisUseCase;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import com.durvalcrm.doador.application.CepPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
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

/** Jornada A (US-CONTRIB-001 a 021) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class ContribuicaoApiIntegracaoTest {

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
    @Autowired CompetenciaRepository competencias;
    @Autowired EventoAuditoriaRepository auditoria;
    @Autowired GerarCompetenciasMensaisUseCase geracao;

    long caixa;
    long bancoA;
    long cartao;

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        List<GrantedAuthority> authorities = Arrays.stream(roles)
                .map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(authorities);
    }

    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() {
        relogio.ajustar("2026-10-19T13:00:00Z");
        caixa = conta("cx-1", "Caixa Secretaria", "CAIXA");
        conta("cx-2", "Caixa Cantina", "CAIXA");
        bancoA = conta("banco-a", "Banco A", "BANCO");
        recebimento(caixa, bancoA);
        cartao = jdbc.sql("select id from conta_financeira where tipo = 'CARTAO_A_RECEBER'").query(Long.class).single();
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

    private long cadastrar(String nome) throws Exception {
        JsonNode d = corpo(enviar(post("/api/doadores"), OPERADOR, Map.of("nome", nome, "telefone", "11987654321",
                "email", "", "consentimentoWhatsapp", "SIM", "consentimentoEmail", "NAO_INFORMADO",
                "duplicatasDescartadas", List.of())).andExpect(status().isCreated()));
        return d.get("id").asLong();
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

    private Map<String, Object> contribuicao(Long doadorId, List<String> meses, String doacao,
            List<Map<String, Object>> pagamentos) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("doadorId", doadorId);
        c.put("anonima", doadorId == null);
        c.put("competencias", meses);
        c.put("valorDoacao", new BigDecimal(doacao));
        c.put("pagamentos", pagamentos);
        c.put("chaveIdempotencia", UUID.randomUUID().toString());
        return c;
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

    private List<String> acoes(String entidade, Object id) {
        return auditoria.listarPorEntidade(entidade, String.valueOf(id)).stream().map(EventoAuditoria::acao).toList();
    }

    private void pendentes(long doadorId, YearMonth... meses) {
        List<Competencia> lista = new ArrayList<>();
        for (YearMonth m : meses) {
            if (!competencias.existe(doadorId, m)) {
                lista.add(Competencia.gerar(doadorId, m, new BigDecimal("50.00")));
            }
        }
        competencias.salvarTodas(lista);
    }

    /** Exemplos das US-CONTRIB-004 e 006: PIX R$ 70 + cartão R$ 50 para R$ 100 devidos, R$ 20 de doação. */
    @Test
    void registraPagamentoMistoComDoacaoNumaUnicaOperacao() throws Exception {
        long doador = cadastrar("Maria Souza");
        pendentes(doador, YearMonth.of(2026, 9));

        mvc.perform(get("/api/contribuicoes/opcoes-pagamento").with(OPERADOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dinheiro.nome").value("Caixa Secretaria"))
                .andExpect(jsonPath("$.pix.nome").value("Banco A"))
                .andExpect(jsonPath("$.cartaoAReceber.nome").value("Cartão a receber"));

        List<Map<String, Object>> pagamentos = List.of(pagamento("PIX", "70.00"),
                pagamento("CARTAO", "50.00"));
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-09", "2026-10"), "0", pagamentos))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem", startsWith("Há R$ 20,00 de excedente sem classificação.")));
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-09", "2026-10"), "0",
                List.of(pagamento("PIX", "70.00"))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem")
                        .value("Faltam R$ 30,00 no valor recebido. Remova uma competência ou ajuste os valores."));

        JsonNode registrada = corpo(enviar(post("/api/contribuicoes"), OPERADOR,
                contribuicao(doador, List.of("2026-09", "2026-10"), "20.00", pagamentos))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numeroRecibo").value("2026-000001"))
                .andExpect(jsonPath("$.tipo").value("MENSALIDADE"))
                .andExpect(jsonPath("$.total").value(120.0)));
        long id = registrada.get("id").asLong();
        mvc.perform(get("/api/contribuicoes/{id}/recibo", id).with(OPERADOR))
                .andExpect(jsonPath("$.pagamentos[1].meio").value("CARTAO"))
                .andExpect(jsonPath("$.pagamentos[1].tipoCartao").value("CREDITO"));

        assertThat(competencias.listarPorDoador(doador)).allSatisfy(c -> {
            assertThat(c.getStatus()).isEqualTo(StatusCompetencia.PAGA);
            assertThat(c.getDataPagamento()).hasToString("2026-10-19");
            assertThat(c.getNumeroRecibo()).isEqualTo("2026-000001");
        });
        assertThat(saldo(bancoA)).isEqualByComparingTo("70.00");
        assertThat(saldo(cartao)).isEqualByComparingTo("50.00");
        assertThat(saldo(caixa)).isEqualByComparingTo("0");
        assertThat(receitas()).containsOnlyKeys("RECEITAS_CONTRIBUICOES.MENSALIDADES",
                "RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS");
        assertThat(receitas().get("RECEITAS_CONTRIBUICOES.MENSALIDADES")).isEqualByComparingTo("100.00");
        assertThat(receitas().get("RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS")).isEqualByComparingTo("20.00");
        assertThat(jdbc.sql("select data_financeira::text from lancamento_financeiro").query(String.class).single())
                .isEqualTo("2026-10-19");
        assertThat(acoes("CONTRIBUICAO", id)).containsExactly("CONTRIBUICAO_REGISTRADA");

        mvc.perform(get("/api/contribuicoes/{id}/recibo", id).with(OPERADOR))
                .andExpect(jsonPath("$.doadorNome").value("Maria Souza"))
                .andExpect(jsonPath("$.operadorNome").value("Ana"))
                .andExpect(jsonPath("$.competencias", hasSize(2)))
                .andExpect(jsonPath("$.pagamentos[0].contaNome").value("Banco A"))
                .andExpect(jsonPath("$.organizacao.nome").isNotEmpty());
    }

    /** Exemplo da US-CONTRIB-003: antecipação de 11/2026 a 01/2027 pelo valor vigente em 19/10/2026. */
    @Test
    void antecipaCompetenciasFuturasPeloValorDoDiaEAGeracaoNaoAsDuplica() throws Exception {
        long doador = cadastrar("João da Silva");

        mvc.perform(get("/api/doadores/{id}/competencias/painel", doador).with(OPERADOR))
                .andExpect(jsonPath("$.quantidadePendentes").value(1))
                .andExpect(jsonPath("$.totalPendente").value(50.0))
                .andExpect(jsonPath("$.itens", hasSize(13)))
                .andExpect(jsonPath("$.itens[0].competencia").value("2026-10"))
                .andExpect(jsonPath("$.itens[0].situacao").value("PENDENTE"))
                .andExpect(jsonPath("$.itens[1].situacao").value("FUTURA"))
                .andExpect(jsonPath("$.itens[12].competencia").value("2027-10"));

        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-11", "2026-12", "2027-01"),
                "0", List.of(pagamento("DINHEIRO", "150.00"))))
                .andExpect(status().isCreated());
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2027-11"), "0",
                List.of(pagamento("DINHEIRO", "50.00"))))
                .andExpect(status().isUnprocessableContent());

        List<Competencia> gravadas = competencias.listarPorDoador(doador);
        assertThat(gravadas).extracting(c -> c.getMes().toString(), Competencia::getStatus).containsExactly(
                org.assertj.core.groups.Tuple.tuple("2026-10", StatusCompetencia.PENDENTE),
                org.assertj.core.groups.Tuple.tuple("2026-11", StatusCompetencia.PAGA),
                org.assertj.core.groups.Tuple.tuple("2026-12", StatusCompetencia.PAGA),
                org.assertj.core.groups.Tuple.tuple("2027-01", StatusCompetencia.PAGA));
        assertThat(saldo(caixa)).isEqualByComparingTo("150.00");

        relogio.ajustar("2027-01-01T03:05:00Z");
        assertThat(geracao.gerar(YearMonth.of(2027, 1))).isZero();
        assertThat(competencias.listarPorDoador(doador)).hasSize(4);
    }

    @Test
    void cliqueDuploNaoCriaDuasContribuicoesEPagamentoRepetidoEhBloqueado() throws Exception {
        long doador = cadastrar("Maria Souza");
        Map<String, Object> dados = contribuicao(doador, List.of("2026-10"), "0",
                List.of(pagamento("DINHEIRO", "50.00")));

        long primeira = corpo(enviar(post("/api/contribuicoes"), OPERADOR, dados).andExpect(status().isCreated()))
                .get("id").asLong();
        long repetida = corpo(enviar(post("/api/contribuicoes"), OPERADOR, dados).andExpect(status().isCreated()))
                .get("id").asLong();
        assertThat(repetida).isEqualTo(primeira);
        assertThat(jdbc.sql("select count(*) from contribuicao").query(Long.class).single()).isEqualTo(1);

        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-10"), "0",
                List.of(pagamento("DINHEIRO", "50.00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("COMPETENCIA_JA_PAGA"))
                .andExpect(jsonPath("$.mensagem").value("Esta competência acabou de ser paga."));
    }

    @Test
    void formaSemContaDeRecebimentoEPerfilSemPermissaoSaoRecusados() throws Exception {
        long doador = cadastrar("Maria Souza");
        Map<String, Object> dados = contribuicao(doador, List.of(), "10.00", List.of(pagamento("DINHEIRO", "10.00")));
        recebimento(null, bancoA);
        enviar(post("/api/contribuicoes"), OPERADOR, dados)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_RECEBIMENTO_NAO_DEFINIDA"));
        recebimento(caixa, bancoA);
        enviar(post("/api/contribuicoes"), TESOUREIRO, dados).andExpect(status().isForbidden());
    }

    /** US-CONTRIB-007 e 008. */
    @Test
    void doacaoExtraordinariaEAnonima() throws Exception {
        long doador = cadastrar("Maria Souza");
        Map<String, Object> extra = contribuicao(doador, List.of(), "80.00", List.of(pagamento("PIX", "80.00")));
        extra.put("observacao", "Campanha de Natal");
        long idExtra = corpo(enviar(post("/api/contribuicoes"), OPERADOR, extra)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("DOACAO_EXTRAORDINARIA"))).get("id").asLong();

        long idAnonima = corpo(enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(null, List.of(), "15.00",
                List.of(pagamento("DINHEIRO", "15.00"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("DOACAO_ANONIMA"))
                .andExpect(jsonPath("$.numeroRecibo").value("2026-000002"))).get("id").asLong();

        assertThat(competencias.listarPorDoador(doador)).allMatch(Competencia::isPendente);
        assertThat(receitas().get("RECEITAS_CONTRIBUICOES.DOACOES_EXTRAORDINARIAS")).isEqualByComparingTo("80.00");
        assertThat(receitas().get("RECEITAS_CONTRIBUICOES.DOACOES_ANONIMAS")).isEqualByComparingTo("15.00");
        mvc.perform(get("/api/contribuicoes/{id}/recibo", idExtra).with(OPERADOR))
                .andExpect(jsonPath("$.observacao").value("Campanha de Natal"));
        mvc.perform(get("/api/contribuicoes/{id}/recibo", idAnonima).with(OPERADOR))
                .andExpect(jsonPath("$.doadorNome").value("Doação anônima"))
                .andExpect(jsonPath("$.doadorId").isEmpty());
        enviar(post("/api/contribuicoes/{id}/mensagens", idAnonima), OPERADOR, Map.of("canal", "WHATSAPP"))
                .andExpect(status().isConflict());
        enviar(post("/api/contribuicoes/{id}/mensagens", idExtra), OPERADOR, Map.of("canal", "WHATSAPP"))
                .andExpect(status().isNoContent());
        assertThat(acoes("CONTRIBUICAO", idExtra)).containsExactly("CONTRIBUICAO_REGISTRADA", "AGRADECIMENTO_PREPARADO");
    }

    /** O Vendedor recebe doações anônimas e vê só os recibos que emitiu. */
    @Test
    void vendedorRecebeSoDoacaoAnonimaEVeSoOsPropriosRecibos() throws Exception {
        long doador = cadastrar("Maria Souza");
        enviar(post("/api/contribuicoes"), VENDEDOR, contribuicao(doador, List.of(), "10.00",
                List.of(pagamento("DINHEIRO", "10.00"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SOMENTE_DOACAO_ANONIMA"));

        long propria = corpo(enviar(post("/api/contribuicoes"), VENDEDOR, contribuicao(null, List.of(), "15.00",
                List.of(pagamento("DINHEIRO", "15.00"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tipo").value("DOACAO_ANONIMA"))).get("id").asLong();
        long doOperador = corpo(enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(null, List.of(), "5.00",
                List.of(pagamento("DINHEIRO", "5.00")))).andExpect(status().isCreated())).get("id").asLong();

        mvc.perform(get("/api/contribuicoes/{id}/recibo", propria).with(VENDEDOR)).andExpect(status().isOk());
        mvc.perform(get("/api/contribuicoes/{id}/recibo", doOperador).with(VENDEDOR)).andExpect(status().isNotFound());
        mvc.perform(get("/api/doadores/{id}/contribuicoes", doador).with(VENDEDOR)).andExpect(status().isForbidden());
    }

    /** US-CONTRIB-011, 009 e 012. */
    @Test
    void cancelamentoEstornaReabrePendentesRemoveAntecipadasEMarcaORecibo() throws Exception {
        long doador = cadastrar("Maria Souza");
        long id = corpo(enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-10", "2026-11"),
                "0", List.of(pagamento("CARTAO", "100.00")))).andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of(), "30.00",
                List.of(pagamento("DINHEIRO", "30.00")))).andExpect(status().isCreated());

        enviar(post("/api/contribuicoes/{id}/cancelamento", id), OPERADOR, Map.of("motivo", "Registrada por engano"))
                .andExpect(status().isForbidden());
        enviar(post("/api/contribuicoes/{id}/cancelamento", id), TESOUREIRO, Map.of("motivo", "engano"))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/contribuicoes/{id}/cancelamento", id), TESOUREIRO, Map.of("motivo", "Registrada por engano"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADA"));

        assertThat(competencias.listarPorDoador(doador)).singleElement().satisfies(c -> {
            assertThat(c.getMes()).isEqualTo(YearMonth.of(2026, 10));
            assertThat(c.getStatus()).isEqualTo(StatusCompetencia.PENDENTE);
            assertThat(c.getNumeroRecibo()).isNull();
        });
        assertThat(saldo(cartao)).isEqualByComparingTo("0");
        assertThat(jdbc.sql("select count(*) from lancamento_financeiro where estorna_lancamento_id is not null")
                .query(Long.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("select count(*) from contribuicao").query(Long.class).single()).isEqualTo(2);
        enviar(post("/api/contribuicoes/{id}/cancelamento", id), TESOUREIRO, Map.of("motivo", "Registrada por engano"))
                .andExpect(status().isConflict());

        mvc.perform(get("/api/contribuicoes/{id}/recibo", id).with(TESOUREIRO).param("segundaVia", "true"))
                .andExpect(jsonPath("$.status").value("CANCELADA"))
                .andExpect(jsonPath("$.segundaVia").value(true))
                .andExpect(jsonPath("$.motivoCancelamento").value("Registrada por engano"));
        mvc.perform(get("/api/contribuicoes/recibos/{numero}", "2026-000001").with(TESOUREIRO))
                .andExpect(jsonPath("$.id").value(id));

        mvc.perform(get("/api/doadores/{id}/contribuicoes", doador).with(OPERADOR).param("ano", "2026"))
                .andExpect(jsonPath("$.ano").value(2026))
                .andExpect(jsonPath("$.totalNoAno").value(30.0))
                .andExpect(jsonPath("$.itens", hasSize(2)))
                .andExpect(jsonPath("$.itens[1].status").value("CANCELADA"))
                .andExpect(jsonPath("$.itens[1].competencias[1]").value("2026-11"))
                .andExpect(jsonPath("$.itens[1].meios[0]").value("CARTAO"));
        assertThat(acoes("CONTRIBUICAO", id)).containsExactly("CONTRIBUICAO_REGISTRADA", "CONTRIBUICAO_CANCELADA");
    }

    @Test
    void cancelamentoBloqueadoQuandoOCartaoJaFoiLiquidado() throws Exception {
        long doador = cadastrar("Maria Souza");
        long id = corpo(enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-10"), "0",
                List.of(pagamento("CARTAO", "50.00")))).andExpect(status().isCreated())).get("id").asLong();
        // Liquidação (US-FINANCIAL-004): o bruto sai de Cartão a receber.
        long liquidacao = jdbc.sql("""
                insert into lancamento_financeiro (data_financeira, origem_tipo, natureza, descricao, criado_por, criado_em)
                values ('2026-10-20', 'LIQUIDACAO_CARTAO', 'LIQUIDACAO', 'Liquidação', 'sub', now()) returning id""")
                .query(Long.class).single();
        jdbc.sql("insert into lancamento_linha_conta values (?, 0, ?, -50.00), (?, 1, ?, 50.00)")
                .params(liquidacao, cartao, liquidacao, bancoA).update();

        enviar(post("/api/contribuicoes/{id}/cancelamento", id), TESOUREIRO, Map.of("motivo", "Registrada por engano"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CARTAO_JA_LIQUIDADO"));
    }

    @Test
    void reciboEmPdfA4ETermico() throws Exception {
        long doador = cadastrar("Maria Souza");
        long id = corpo(enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-10"), "0",
                List.of(pagamento("DINHEIRO", "50.00")))).andExpect(status().isCreated())).get("id").asLong();

        for (String layout : List.of("A4", "TERMICA")) {
            long inicio = System.nanoTime();
            byte[] pdf = mvc.perform(get("/api/contribuicoes/{id}/recibo.pdf", id).with(OPERADOR)
                            .param("layout", layout).param("segundaVia", "true"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Content-Type", "application/pdf"))
                    .andExpect(header().string("Content-Disposition", startsWith("attachment;")))
                    .andReturn().getResponse().getContentAsByteArray();
            assertThat(System.nanoTime() - inicio).isLessThan(2_000_000_000L);
            assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        }
    }

    /** US-CONTRIB-021. */
    @Test
    void painelDoOperadorResumeODiaDoQueEleRecebeu() throws Exception {
        long doador = cadastrar("Maria Souza");
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(doador, List.of("2026-10"), "10.00",
                List.of(pagamento("DINHEIRO", "40.00"), pagamento("PIX", "20.00"))))
                .andExpect(status().isCreated());
        enviar(post("/api/contribuicoes"), OPERADOR, contribuicao(null, List.of(), "5.00",
                List.of(pagamento("CARTAO", "5.00")))).andExpect(status().isCreated());

        mvc.perform(get("/api/contribuicoes/painel-operador").with(OPERADOR))
                .andExpect(jsonPath("$.data").value("2026-10-19"))
                .andExpect(jsonPath("$.quantidade").value(2))
                .andExpect(jsonPath("$.totalDinheiro").value(40.0))
                .andExpect(jsonPath("$.totalPix").value(20.0))
                .andExpect(jsonPath("$.totalCartao").value(5.0))
                .andExpect(jsonPath("$.ultimas", hasSize(2)))
                .andExpect(jsonPath("$.ultimas[1].doadorNome").value("Maria Souza"));
    }

    /** US-CONTRIB-001. */
    @Test
    void geracaoMensalCriaUmaPendentePorDoadorAtivoEEhIdempotente() throws Exception {
        long ativo = cadastrar("Maria Souza");
        long inativo = cadastrar("João da Silva");
        jdbc.sql("update doador set status = 'INATIVO' where id = ?").param(inativo).update();

        relogio.ajustar("2026-11-01T03:00:00Z");
        assertThat(geracao.pendente(YearMonth.of(2026, 11))).isFalse();
        relogio.ajustar("2026-11-01T03:05:00Z");
        assertThat(geracao.pendente(YearMonth.of(2026, 11))).isTrue();
        mvc.perform(get("/api/contribuicoes/geracao-competencias").with(TESOUREIRO))
                .andExpect(jsonPath("$.estado").value("AGUARDANDO"));

        geracao.registrarFalha(YearMonth.of(2026, 11), "Banco indisponível");
        mvc.perform(get("/api/contribuicoes/geracao-competencias").with(TESOUREIRO))
                .andExpect(jsonPath("$.estado").value("FALHA"))
                .andExpect(jsonPath("$.tentativas").value(1));
        mvc.perform(get("/api/contribuicoes/geracao-competencias").with(OPERADOR)).andExpect(status().isForbidden());

        assertThat(geracao.gerar(YearMonth.of(2026, 11))).isEqualTo(1);
        assertThat(geracao.gerar(YearMonth.of(2026, 11))).isZero();
        assertThat(geracao.pendente(YearMonth.of(2026, 11))).isFalse();
        assertThat(competencias.existe(ativo, YearMonth.of(2026, 11))).isTrue();
        assertThat(competencias.existe(inativo, YearMonth.of(2026, 11))).isFalse();
        mvc.perform(get("/api/contribuicoes/geracao-competencias").with(TESOUREIRO))
                .andExpect(jsonPath("$.estado").value("CONCLUIDA"));
        assertThat(auditoria.listarPorEntidade("GERACAO_COMPETENCIAS", "2026-11").getFirst().detalhes())
                .containsEntry("mes", "2026-11").containsEntry("criadas", 1).containsKey("duracaoMs");
    }
}
