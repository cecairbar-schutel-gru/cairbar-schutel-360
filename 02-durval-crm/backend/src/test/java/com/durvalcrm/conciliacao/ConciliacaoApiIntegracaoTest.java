package com.durvalcrm.conciliacao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.doador.application.CepPort;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Arrays;
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

/** Conciliação bancária (US-RECONCILIATION-001 a 010) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class ConciliacaoApiIntegracaoTest {

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

    long caixa;
    long banco;

    private static List<GrantedAuthority> papeis(String... roles) {
        return Arrays.stream(roles).map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
    }

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(papeis(roles));
    }

    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-10-20T13:00:00Z");
        caixa = cadastrar(mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "saldoInicial", 200, "dataCorte", "2026-10-01"));
        banco = cadastrar(mapa("tipo", "BANCO", "nome", "Banco A", "banco", "Banco do Brasil", "agencia", "1234",
                "numeroConta", "56789-0", "saldoInicial", 1000, "dataCorte", "2026-10-01"));
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    private long cadastrar(Map<String, Object> conta) throws Exception {
        return corpo(enviar(post("/api/financeiro/contas"), ADMIN, conta).andExpect(status().isCreated()))
                .get("id").asLong();
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

    private long manual(String data, String tipo, String categoria, String valor, String descricao) throws Exception {
        return corpo(enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", banco, "data", data,
                "tipo", tipo, "categoria", categoria, "valor", valor, "descricao", descricao))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    private long transferir(long de, long para, String valor, String data) throws Exception {
        return corpo(enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", de,
                "contaDestinoId", para, "valor", valor, "data", data)).andExpect(status().isCreated()))
                .get("id").asLong();
    }

    private long iniciar(String dataFim, String saldo) throws Exception {
        return corpo(enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", dataFim,
                "saldoExtrato", saldo)).andExpect(status().isCreated())).get("id").asLong();
    }

    private ResultActions marcar(long sessao, boolean marcado, long... ids) throws Exception {
        return enviar(post("/api/conciliacoes/{id}/marcacoes", sessao), TESOUREIRO,
                mapa("lancamentoIds", Arrays.stream(ids).boxed().toList(), "marcado", marcado));
    }

    private List<String> acoes(long sessao) {
        return auditoria.listarPorEntidade("Conciliacao", String.valueOf(sessao)).stream().map(EventoAuditoria::acao)
                .toList();
    }

    /** Roteiro de validação do Tesoureiro (Spec §9): iniciar → marcar → registrar o ausente → concluir. */
    @Test
    void conciliaUmaContaDoInicioAoFim() throws Exception {
        long luz = manual("2026-10-05", "DESPESA", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "100", "Conta de luz");
        long deposito = transferir(caixa, banco, "50", "2026-10-10");
        long pixAtrasado = manual("2026-10-14", "RECEITA", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "30", "PIX do bazar");
        long depoisDoExtrato = manual("2026-10-18", "RECEITA", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "20", "Bazar");

        // US-RECONCILIATION-001: contas bancárias com a situação de cada uma.
        mvc.perform(get("/api/conciliacoes/contas").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].contaNome").value("Banco A"))
                .andExpect(jsonPath("$[0].naoConciliados").value(4))
                .andExpect(jsonPath("$[0].conciliadaAte").isEmpty())
                .andExpect(jsonPath("$[0].sessaoId").isEmpty());
        mvc.perform(get("/api/conciliacoes/contas").with(OPERADOR)).andExpect(status().isForbidden());
        enviar(post("/api/conciliacoes"), OPERADOR, mapa("contaId", banco, "dataFim", "2026-10-15", "saldoExtrato", "945"))
                .andExpect(status().isForbidden());
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-10-20", "saldoExtrato", "1"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("dataFim"))
                .andExpect(jsonPath("$.erros[0].mensagem").value(
                        "Use uma data até ontem (19/10/2026): o extrato de hoje só fecha amanhã."));
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", caixa, "dataFim", "2026-10-15", "saldoExtrato", "1"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("contaId"));

        // Extrato até 15/10: luz, depósito do caixa e uma tarifa de R$ 5,00 que o sistema não tem.
        long sessao = iniciar("2026-10-15", "945.00");
        mvc.perform(get("/api/conciliacoes/{id}", sessao).with(TESOUREIRO))
                .andExpect(jsonPath("$.status").value("EM_ANDAMENTO"))
                .andExpect(jsonPath("$.saldoAbertura").value(1000.0))
                .andExpect(jsonPath("$.diferenca").value(-55.0))
                .andExpect(jsonPath("$.lancamentos", hasSize(3)))
                .andExpect(jsonPath("$.lancamentos[0].valor").value(-100.0))
                .andExpect(jsonPath("$.lancamentos[0].podeCorrigir").value(true))
                .andExpect(jsonPath("$.lancamentos[1].natureza").value("TRANSFERENCIA"))
                .andExpect(jsonPath("$.lancamentos[1].valor").value(50.0));
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-10-16", "saldoExtrato", "1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONCILIACAO_EM_ANDAMENTO"));
        mvc.perform(get("/api/conciliacoes/contas").with(TESOUREIRO))
                .andExpect(jsonPath("$[0].sessaoId").value(sessao))
                .andExpect(jsonPath("$[0].sessaoDataFim").value("2026-10-15"));

        // US-RECONCILIATION-003: cada clique é gravado, com quem marcou.
        marcar(sessao, true, luz, deposito).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMarcado").value(-50.0))
                .andExpect(jsonPath("$.diferenca").value(-5.0))
                .andExpect(jsonPath("$.lancamentos[0].marcado").value(true))
                .andExpect(jsonPath("$.lancamentos[0].marcadoPor").value("Carla"))
                .andExpect(jsonPath("$.lancamentos[2].marcado").value(false));
        marcar(sessao, false, deposito).andExpect(jsonPath("$.diferenca").value(45.0));
        marcar(sessao, true, deposito).andExpect(jsonPath("$.diferenca").value(-5.0));
        marcar(sessao, true, depoisDoExtrato)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("LANCAMENTO_NAO_CONCILIAVEL"));
        // Marcar de novo não muda nada (clique repetido).
        marcar(sessao, true, luz).andExpect(status().isOk()).andExpect(jsonPath("$.diferenca").value(-5.0));
        enviar(post("/api/conciliacoes/{id}/marcacoes", sessao), OPERADOR, mapa("lancamentoIds", List.of(luz)))
                .andExpect(status().isForbidden());
        enviar(post("/api/conciliacoes/{id}/conclusao", sessao), TESOUREIRO, Map.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("DIFERENCA_NAO_ZERADA"));

        // US-RECONCILIATION-005: a tarifa entra já marcada; fora do extrato, não.
        enviar(post("/api/conciliacoes/{id}/lancamentos", sessao), TESOUREIRO, mapa("tipo", "DESPESA",
                "data", "2026-10-16", "categoria", "OUTRAS_DESPESAS.TAXAS_BANCARIAS", "valor", "5", "descricao", "Tarifa"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("data"));
        long tarifa = corpo(enviar(post("/api/conciliacoes/{id}/lancamentos", sessao), TESOUREIRO, mapa("tipo", "DESPESA",
                "data", "2026-10-15", "categoria", "OUTRAS_DESPESAS.TAXAS_BANCARIAS", "valor", "5",
                "descricao", "Tarifa de manutenção", "chaveIdempotencia", "tarifa-1"))
                .andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(get("/api/conciliacoes/{id}", sessao).with(TESOUREIRO))
                .andExpect(jsonPath("$.diferenca").value(0.0))
                .andExpect(jsonPath("$.lancamentos", hasSize(4)))
                .andExpect(jsonPath("$.lancamentos[3].id").value(tarifa))
                .andExpect(jsonPath("$.lancamentos[3].marcado").value(true))
                .andExpect(jsonPath("$.lancamentos[3].adicionado").value(true));

        // US-RECONCILIATION-007: conclui; o PIX de 14/10 fica pendente e vai para a próxima sessão.
        enviar(post("/api/conciliacoes/{id}/conclusao", sessao), TESOUREIRO, Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONCLUIDA"))
                .andExpect(jsonPath("$.concluidaPor").value("Carla"))
                .andExpect(jsonPath("$.lancamentos", hasSize(3)))
                .andExpect(jsonPath("$.pendentes", hasSize(1)))
                .andExpect(jsonPath("$.pendentes[0].id").value(pixAtrasado));
        marcar(sessao, false, luz)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONCILIACAO_CONCLUIDA"));
        mvc.perform(get("/api/conciliacoes/contas").with(ADMIN))
                .andExpect(jsonPath("$[0].conciliadaAte").value("2026-10-15"))
                .andExpect(jsonPath("$[0].saldoConciliado").value(945.0))
                .andExpect(jsonPath("$[0].naoConciliados").value(2))
                .andExpect(jsonPath("$[0].sessaoId").isEmpty());
        mvc.perform(get("/api/financeiro/lancamentos/{id}", luz).with(TESOUREIRO))
                .andExpect(jsonPath("$.conciliado").value(true));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(jsonPath("$.conciliacoes[0].naoConciliados").value(2))
                .andExpect(jsonPath("$.conciliacoes[0].ultimaConciliacao").value("2026-10-15"));
        assertThat(jdbc.sql("select count(*) from lancamento_linha_conta where conciliacao_id = ?").param(sessao)
                .query(Long.class).single()).isEqualTo(3);
        assertThat(acoes(sessao)).containsExactly("CONCILIACAO_INICIADA", "LANCAMENTOS_MARCADOS",
                "LANCAMENTOS_DESMARCADOS", "LANCAMENTOS_MARCADOS", "LANCAMENTOS_MARCADOS", "LANCAMENTO_ADICIONADO",
                "CONCILIACAO_CONCLUIDA");

        // US-RECONCILIATION-010: histórico e relatório.
        mvc.perform(get("/api/conciliacoes").param("contaId", String.valueOf(banco)).with(ADMIN))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].dataFim").value("2026-10-15"))
                .andExpect(jsonPath("$[0].saldoExtrato").value(945.0))
                .andExpect(jsonPath("$[0].conciliados").value(3))
                .andExpect(jsonPath("$[0].pendentes").value(1))
                .andExpect(jsonPath("$[0].concluidaPor").value("Carla"));

        // Erro descoberto depois: corrige-se por estorno, conciliado numa sessão futura.
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", luz), TESOUREIRO,
                mapa("motivo", "Conta de luz lançada em dobro"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.avisos[0]").value(
                        "O lançamento original estava conciliado: concilie também o estorno na próxima sessão."));
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-10-15", "saldoExtrato", "1"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value("Use uma data posterior à última conciliação (15/10/2026)."));
        // O extrato de hoje só fecha amanhã: a sessão até 20/10 começa no dia 21.
        relogio.ajustar("2026-10-21T13:00:00Z");
        long proxima = iniciar("2026-10-20", "1095.00");
        mvc.perform(get("/api/conciliacoes/{id}", proxima).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoAbertura").value(945.0))
                .andExpect(jsonPath("$.dataFimAnterior").value("2026-10-15"))
                .andExpect(jsonPath("$.lancamentos[*].descricao").value(org.hamcrest.Matchers.contains(
                        "Estorno: Conta de luz", "PIX do bazar", "Bazar")))
                .andExpect(jsonPath("$.lancamentos[0].podeCorrigir").value(false));
    }

    /** Depósito do caixa ausente é transferência; nova data final desmarca o que ficou depois dela. */
    @Test
    void registraTransferenciaAusenteECorrigeOExtrato() throws Exception {
        relogio.ajustar("2026-10-21T13:00:00Z");
        long sessao = iniciar("2026-10-20", "1100");
        long deposito = corpo(enviar(post("/api/conciliacoes/{id}/lancamentos", sessao), TESOUREIRO, mapa(
                "tipo", "TRANSFERENCIA", "contraparteId", caixa, "entrada", true, "data", "2026-10-18", "valor", "100",
                "descricao", "Depósito do caixa")).andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(get("/api/conciliacoes/{id}", sessao).with(TESOUREIRO))
                .andExpect(jsonPath("$.diferenca").value(0.0))
                .andExpect(jsonPath("$.lancamentos[0].id").value(deposito))
                .andExpect(jsonPath("$.lancamentos[0].natureza").value("TRANSFERENCIA"))
                .andExpect(jsonPath("$.lancamentos[0].adicionado").value(true));
        mvc.perform(get("/api/financeiro/contas/{id}", caixa).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldo").value(100.0));
        enviar(post("/api/conciliacoes/{id}/lancamentos", sessao), TESOUREIRO, mapa("tipo", "TRANSFERENCIA",
                "data", "2026-10-18", "valor", "1")).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("contraparteId"));

        // O Administrador também concilia.
        enviar(put("/api/conciliacoes/{id}/extrato", sessao), ADMIN, mapa("dataFim", "2026-10-12",
                "saldoExtrato", "1000")).andExpect(status().isOk())
                .andExpect(jsonPath("$.dataFim").value("2026-10-12"))
                .andExpect(jsonPath("$.lancamentos", hasSize(0)))
                .andExpect(jsonPath("$.totalMarcado").value(0.0))
                .andExpect(jsonPath("$.diferenca").value(0.0));
        assertThat(acoes(sessao)).contains("CONCILIACAO_EXTRATO_ALTERADO");
        mvc.perform(get("/api/conciliacoes/{id}", sessao).with(ADMIN)).andExpect(status().isOk());
        mvc.perform(get("/api/conciliacoes/{id}", 999_999).with(TESOUREIRO)).andExpect(status().isNotFound());
    }

    /** Extrato importado: linhas do período, sugestões, pares confirmados, lançamento ausente e desfazer. */
    @Test
    void importaOExtratoEConfirmaOsParesSugeridos() throws Exception {
        long luz = manual("2026-10-05", "DESPESA", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "100", "Conta de luz");
        long deposito = transferir(caixa, banco, "50", "2026-10-10");
        long sessao = iniciar("2026-10-15", "945.00");
        List<Map<String, Object>> linhas = List.of(
                mapa("data", "2026-09-30", "descricao", "Saldo anterior", "valor", "1000"),
                mapa("data", "2026-10-06", "descricao", "PAGTO ENERGIA", "valor", "-100.00", "identificador", "A1"),
                mapa("data", "2026-10-10", "descricao", "DEP DINHEIRO", "valor", "50"),
                mapa("data", "2026-10-15", "descricao", "TARIFA PACOTE", "valor", "-5"),
                mapa("data", "2026-10-16", "descricao", "Depois do extrato", "valor", "1"));

        enviar(put("/api/conciliacoes/{id}/extrato/linhas", sessao), OPERADOR,
                mapa("arquivo", "extrato.csv", "formato", "CSV", "linhas", linhas)).andExpect(status().isForbidden());
        enviar(put("/api/conciliacoes/{id}/extrato/linhas", sessao), TESOUREIRO,
                mapa("arquivo", "extrato.csv", "formato", "CSV", "linhas", List.of(linhas.get(4))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("linhas"));
        enviar(put("/api/conciliacoes/{id}/extrato/linhas", sessao), TESOUREIRO,
                mapa("arquivo", "extrato.csv", "formato", "CSV", "linhas", linhas))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.extrato.arquivo").value("extrato.csv"))
                .andExpect(jsonPath("$.extrato.importadoPor").value("Carla"))
                .andExpect(jsonPath("$.extrato.linhas", hasSize(3)))
                .andExpect(jsonPath("$.extrato.linhas[0].identificador").value("A1"))
                .andExpect(jsonPath("$.extrato.linhas[0].sugestaoId").value(luz))
                .andExpect(jsonPath("$.extrato.linhas[1].sugestaoId").value(deposito))
                .andExpect(jsonPath("$.extrato.linhas[2].sugestaoId").isEmpty())
                .andExpect(jsonPath("$.totalMarcado").value(0.0));
        JsonNode extrato = corpo(mvc.perform(get("/api/conciliacoes/{id}", sessao).with(TESOUREIRO))).get("extrato");
        long linhaLuz = extrato.get("linhas").get(0).get("id").asLong();
        long linhaDeposito = extrato.get("linhas").get(1).get("id").asLong();
        long linhaTarifa = extrato.get("linhas").get(2).get("id").asLong();

        enviar(post("/api/conciliacoes/{id}/extrato/pares", sessao), TESOUREIRO, mapa("pares", List.of(
                mapa("linhaId", linhaLuz, "lancamentoId", luz), mapa("linhaId", linhaDeposito, "lancamentoId", deposito))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diferenca").value(-5.0))
                .andExpect(jsonPath("$.lancamentos[0].marcado").value(true))
                .andExpect(jsonPath("$.extrato.linhas[0].lancamentoId").value(luz))
                .andExpect(jsonPath("$.extrato.linhas[0].conferidaPor").value("Carla"))
                .andExpect(jsonPath("$.extrato.linhas[0].sugestaoId").isEmpty());
        enviar(post("/api/conciliacoes/{id}/extrato/pares", sessao), TESOUREIRO, mapa("pares", List.of(
                mapa("linhaId", linhaLuz, "lancamentoId", luz))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("LINHA_EXTRATO_CONFERIDA"));
        enviar(post("/api/conciliacoes/{id}/extrato/pares", sessao), TESOUREIRO, mapa("pares", List.of(
                mapa("linhaId", linhaTarifa, "lancamentoId", luz))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("LANCAMENTO_JA_PAREADO"));

        // A tarifa sem lançamento vira o lançamento ausente ligado à linha.
        enviar(post("/api/conciliacoes/{id}/lancamentos", sessao), TESOUREIRO, mapa("tipo", "DESPESA",
                "data", "2026-10-15", "categoria", "OUTRAS_DESPESAS.TAXAS_BANCARIAS", "valor", "5",
                "descricao", "TARIFA PACOTE", "linhaExtratoId", linhaTarifa)).andExpect(status().isCreated());
        mvc.perform(get("/api/conciliacoes/{id}", sessao).with(TESOUREIRO))
                .andExpect(jsonPath("$.diferenca").value(0.0))
                .andExpect(jsonPath("$.extrato.linhas[2].lancamentoId").isNumber());

        // Desfazer o par desmarca o lançamento; desmarcar na lista desfaz o par.
        mvc.perform(delete("/api/conciliacoes/{id}/extrato/linhas/{linha}/par", sessao, linhaDeposito).with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diferenca").value(50.0))
                .andExpect(jsonPath("$.extrato.linhas[1].lancamentoId").isEmpty())
                .andExpect(jsonPath("$.extrato.linhas[1].sugestaoId").value(deposito));
        marcar(sessao, false, luz).andExpect(jsonPath("$.extrato.linhas[0].lancamentoId").isEmpty())
                .andExpect(jsonPath("$.extrato.linhas[0].sugestaoId").value(luz));

        // Importar de novo substitui o extrato; as marcações ficam.
        enviar(put("/api/conciliacoes/{id}/extrato/linhas", sessao), TESOUREIRO,
                mapa("arquivo", "extrato.ofx", "formato", "OFX", "linhas", linhas.subList(1, 2)))
                .andExpect(jsonPath("$.extrato.formato").value("OFX"))
                .andExpect(jsonPath("$.extrato.linhas", hasSize(1)))
                .andExpect(jsonPath("$.totalMarcado").value(-5.0));
        assertThat(acoes(sessao)).containsSubsequence("EXTRATO_IMPORTADO", "EXTRATO_PARES_CONFIRMADOS",
                "LANCAMENTO_ADICIONADO", "EXTRATO_PAR_DESFEITO", "LANCAMENTOS_DESMARCADOS", "EXTRATO_IMPORTADO");
    }
}
