package com.durvalcrm.financeiro;

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

/** Módulo Financeiro (US-FINANCIAL-001 a 021) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class FinanceiroApiIntegracaoTest {

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
    long bancoA;
    long cartao;

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
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-10-20T13:00:00Z");
        caixa = cadastrar(mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "localizacao", "Recepção", "saldoInicial", 200, "dataCorte", "2026-10-01"));
        bancoA = cadastrar(mapa("tipo", "BANCO", "nome", "Banco A", "banco", "Banco do Brasil", "agencia", "1234",
                "numeroConta", "56789-0", "saldoInicial", 1000, "dataCorte", "2026-10-01"));
        cartao = jdbc.sql("select id from conta_financeira where tipo = 'CARTAO_A_RECEBER'").query(Long.class).single();
        jdbc.sql("update conta_financeira set saldo_inicial = 1000, data_corte = '2026-10-01' where id = ?")
                .param(cartao).update();
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

    private BigDecimal saldo(long conta) throws Exception {
        return new BigDecimal(corpo(mvc.perform(get("/api/financeiro/contas/{id}", conta).with(TESOUREIRO)))
                .get("saldo").asString());
    }

    private List<String> acoes(String entidade, Object id) {
        return auditoria.listarPorEntidade(entidade, String.valueOf(id)).stream().map(EventoAuditoria::acao).toList();
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put((String) pares[i], pares[i + 1]);
        }
        return m;
    }

    private long transferir(long de, long para, String valor) throws Exception {
        return corpo(enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", de,
                "contaDestinoId", para, "valor", valor, "data", "2026-10-20")).andExpect(status().isCreated()))
                .get("id").asLong();
    }

    private long despesaManual(long conta, String valor, String categoria) throws Exception {
        return corpo(enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", conta, "data",
                "2026-10-15", "tipo", "DESPESA", "categoria", categoria, "valor", valor, "descricao", "Conta de luz"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    /** US-FINANCIAL-001: cadastro pelo Administrador, com saldo inicial e data de corte. */
    @Test
    void cadastraContasComRegrasDeAlteracaoInativacaoEExclusao() throws Exception {
        enviar(post("/api/financeiro/contas"), OPERADOR, mapa("tipo", "BANCO", "nome", "X", "banco", "B",
                "agencia", "1", "numeroConta", "2", "saldoInicial", 0, "dataCorte", "2026-10-01"))
                .andExpect(status().isForbidden());
        enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "CARTAO_A_RECEBER", "nome", "Outro cartão",
                "saldoInicial", 0, "dataCorte", "2026-10-01"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CARTAO_A_RECEBER_UNICO"));
        // O código é gerado do nome, com sufixo quando já existe.
        enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "saldoInicial", 0, "dataCorte", "2026-10-01"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codigo").value("caixa-secretaria-2"));
        enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "BANCO", "nome", "Banco B", "saldoInicial", -50,
                "dataCorte", "2026-10-01"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[*].campo").value(org.hamcrest.Matchers.containsInAnyOrder("banco",
                        "agencia", "numeroConta")));

        mvc.perform(get("/api/financeiro/contas/{id}", bancoA).with(TESOUREIRO))
                .andExpect(jsonPath("$.codigo").value("banco-a"))
                .andExpect(jsonPath("$.saldo").value(1000.0))
                .andExpect(jsonPath("$.temLancamentos").value(false));

        // Sem lançamentos, saldo inicial e data de corte podem mudar; depois do primeiro, não.
        Map<String, Object> dados = mapa("nome", "Caixa da Secretaria", "localizacao", "Recepção", "saldoInicial", 150,
                "dataCorte", "2026-10-02");
        enviar(put("/api/financeiro/contas/{id}", caixa), ADMIN, dados).andExpect(status().isOk())
                .andExpect(jsonPath("$.saldoInicial").value(150.0));
        transferir(caixa, bancoA, "50");
        dados.put("saldoInicial", 300);
        enviar(put("/api/financeiro/contas/{id}", caixa), ADMIN, dados)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_COM_LANCAMENTOS"));

        // Inativar exige saldo zero; excluir, nenhum lançamento.
        mvc.perform(post("/api/financeiro/contas/{id}/inativacao", caixa).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_COM_SALDO"));
        mvc.perform(delete("/api/financeiro/contas/{id}", caixa).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_COM_LANCAMENTOS"));
        long vazio = cadastrar(mapa("tipo", "CAIXA", "nome", "Caixa Eventos",
                "saldoInicial", 0, "dataCorte", "2026-10-01"));
        mvc.perform(post("/api/financeiro/contas/{id}/inativacao", vazio).with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.ativa").value(false));
        mvc.perform(post("/api/financeiro/contas/{id}/reativacao", vazio).with(ADMIN)).andExpect(status().isOk());
        mvc.perform(delete("/api/financeiro/contas/{id}", vazio).with(ADMIN)).andExpect(status().isNoContent());

        assertThat(acoes("ContaFinanceira", caixa)).containsExactly("CONTA_CADASTRADA", "CONTA_ALTERADA");
        assertThat(acoes("ContaFinanceira", vazio)).containsExactly("CONTA_CADASTRADA", "CONTA_INATIVADA",
                "CONTA_REATIVADA", "CONTA_EXCLUIDA");
    }

    /** US-FINANCIAL-001: o Tesoureiro cadastra e altera contas bancárias, mas não caixas nem inativação. */
    @Test
    void tesoureiroCadastraSoContasBancarias() throws Exception {
        long banco = corpo(enviar(post("/api/financeiro/contas"), TESOUREIRO, mapa("tipo", "BANCO", "nome", "Banco C",
                "banco", "Caixa Econômica", "agencia", "0001", "numeroConta", "123-4", "saldoInicial", 0,
                "dataCorte", "2026-10-01")).andExpect(status().isCreated())).get("id").asLong();
        enviar(put("/api/financeiro/contas/{id}", banco), TESOUREIRO, mapa("nome", "Banco C", "banco",
                "Caixa Econômica", "agencia", "0002", "numeroConta", "123-4", "saldoInicial", 0,
                "dataCorte", "2026-10-01")).andExpect(status().isOk())
                .andExpect(jsonPath("$.agencia").value("0002"));

        enviar(post("/api/financeiro/contas"), TESOUREIRO, mapa("tipo", "CAIXA", "nome", "X",
                "saldoInicial", 0, "dataCorte", "2026-10-01"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SO_CONTA_BANCARIA"));
        enviar(put("/api/financeiro/contas/{id}", caixa), TESOUREIRO, mapa("nome", "X", "saldoInicial", 200,
                "dataCorte", "2026-10-01"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SO_CONTA_BANCARIA"));
        mvc.perform(post("/api/financeiro/contas/{id}/inativacao", banco).with(TESOUREIRO))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/financeiro/contas/{id}", banco).with(TESOUREIRO)).andExpect(status().isForbidden());

        assertThat(acoes("ContaFinanceira", banco)).containsExactly("CONTA_CADASTRADA", "CONTA_ALTERADA");
    }

    /** US-FINANCIAL-002: agrupado por tipo, só para a tesouraria; saldo em data passada. */
    @Test
    void mostraSaldosPorTipoSoParaATesouraria() throws Exception {
        relogio.ajustar("2026-10-21T13:00:00Z");
        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", caixa, "contaDestinoId",
                bancoA, "valor", "80", "data", "2026-10-21")).andExpect(status().isCreated());

        mvc.perform(get("/api/financeiro/saldos").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caixas", hasSize(1)))
                .andExpect(jsonPath("$.caixas[0].saldo").value(120.0))
                .andExpect(jsonPath("$.bancos[0].saldo").value(1080.0))
                .andExpect(jsonPath("$.cartaoAReceber.saldo").value(1000.0))
                .andExpect(jsonPath("$.subtotalCaixas").value(120.0))
                .andExpect(jsonPath("$.total").value(2200.0));
        mvc.perform(get("/api/financeiro/saldos").param("data", "2026-10-20").with(TESOUREIRO))
                .andExpect(jsonPath("$.caixas[0].saldo").value(200.0));
        mvc.perform(get("/api/financeiro/saldos").param("data", "2026-09-30").with(TESOUREIRO))
                .andExpect(jsonPath("$.caixas[0].saldo").doesNotExist());

        mvc.perform(get("/api/financeiro/saldos").with(OPERADOR)).andExpect(status().isForbidden());
        mvc.perform(get("/api/financeiro/saldos").with(VENDEDOR)).andExpect(status().isForbidden());
    }

    /** US-FINANCIAL-003: duas pernas atômicas, sem categoria; caixa negativo e Cartão a receber bloqueados. */
    @Test
    void transfereEntreContasSemGerarReceitaNemDespesa() throws Exception {
        long id = transferir(caixa, bancoA, "150");
        assertThat(saldo(caixa)).isEqualByComparingTo("50");
        assertThat(saldo(bancoA)).isEqualByComparingTo("1150");
        mvc.perform(get("/api/financeiro/lancamentos/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.natureza").value("TRANSFERENCIA"))
                .andExpect(jsonPath("$.linhasConta", hasSize(2)))
                .andExpect(jsonPath("$.linhasCategoria", hasSize(0)))
                .andExpect(jsonPath("$.descricao").value("Transferência de Caixa Secretaria para Banco A"));
        // Aparece no extrato das duas contas.
        mvc.perform(get("/api/financeiro/lancamentos").param("contaId", String.valueOf(caixa)).with(TESOUREIRO))
                .andExpect(jsonPath("$.itens[0].id").value(id))
                .andExpect(jsonPath("$.itens[0].valor").value(-150.0));
        mvc.perform(get("/api/financeiro/lancamentos").param("contaId", String.valueOf(bancoA)).with(TESOUREIRO))
                .andExpect(jsonPath("$.itens[0].valor").value(150.0));

        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", caixa, "contaDestinoId",
                bancoA, "valor", "50.01", "data", "2026-10-20"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SALDO_INSUFICIENTE"));
        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", cartao, "contaDestinoId",
                bancoA, "valor", "10", "data", "2026-10-20"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("TRANSFERENCIA_CARTAO"));
        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", bancoA, "contaDestinoId",
                bancoA, "valor", "10", "data", "2026-10-20"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("contaDestinoId"));
        enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", bancoA, "contaDestinoId",
                caixa, "valor", "10", "data", "2026-09-30"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("ANTES_DA_DATA_DE_CORTE"));

        // Banco pode ficar negativo, com aviso; o mesmo pedido repetido não duplica.
        Map<String, Object> grande = mapa("contaOrigemId", bancoA, "contaDestinoId", caixa, "valor", "1200",
                "data", "2026-10-20", "chaveIdempotencia", "t-1");
        long repetida = corpo(enviar(post("/api/financeiro/transferencias"), TESOUREIRO, grande)
                .andExpect(jsonPath("$.avisos[0]").value("O saldo de Banco A ficou negativo: -R$ 50,00."))).get("id").asLong();
        assertThat(corpo(enviar(post("/api/financeiro/transferencias"), TESOUREIRO, grande)).get("id").asLong())
                .isEqualTo(repetida);
        assertThat(saldo(bancoA)).isEqualByComparingTo("-50");
        mvc.perform(get("/api/financeiro/saldos").with(TESOUREIRO))
                .andExpect(jsonPath("$.bancos[0].saldo").value(-50.0));
    }

    /** US-FINANCIAL-004: exemplo da história. */
    @Test
    void liquidaCartaoComTaxaComoDespesa() throws Exception {
        long id = corpo(enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "600", "taxa", "18", "referencia", "LOTE-77"))
                .andExpect(status().isCreated())).get("id").asLong();
        assertThat(saldo(cartao)).isEqualByComparingTo("400");
        assertThat(saldo(bancoA)).isEqualByComparingTo("1582");
        mvc.perform(get("/api/financeiro/lancamentos/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.natureza").value("LIQUIDACAO"))
                .andExpect(jsonPath("$.valor").value(600.0))
                .andExpect(jsonPath("$.referenciaExterna").value("LOTE-77"))
                .andExpect(jsonPath("$.linhasCategoria[0].codigo").value("DESPESAS_COMERCIAIS.TAXAS_CARTAO"))
                .andExpect(jsonPath("$.linhasCategoria[0].valor").value(-18.0));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(jsonPath("$.resumoDoMes.taxasCartao").value(18.0))
                .andExpect(jsonPath("$.resumoDoMes.despesas").value(18.0));

        enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "450", "taxa", "10"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("BRUTO_EXCEDE_CARTAO_A_RECEBER"))
                .andExpect(jsonPath("$.mensagem").value(
                        "O bruto de R$ 450,00 excede o saldo de Cartão a receber de R$ 400,00."));
        enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "100", "taxa", "100"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("taxa"));
        enviar(post("/api/financeiro/liquidacoes-cartao"), ADMIN, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "100", "taxa", "1")).andExpect(status().isForbidden());
    }

    /** Simulação de 27/10/2026, P9: o tipo liquidado é opcional e só divide o saldo a receber. */
    @Test
    void liquidacaoComTipoDivideOSaldoDeCartaoAReceber() throws Exception {
        mvc.perform(get("/api/financeiro/cartao-a-receber").with(TESOUREIRO))
                .andExpect(jsonPath("$.total").value(1000.0))
                .andExpect(jsonPath("$.naoInformado").value(1000.0));
        long id = corpo(enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "100", "taxa", "2", "tipoCartao", "DEBITO"))
                .andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(get("/api/financeiro/cartao-a-receber").with(ADMIN))
                .andExpect(jsonPath("$.total").value(900.0))
                .andExpect(jsonPath("$.debito").value(-100.0))
                .andExpect(jsonPath("$.credito").value(0.0))
                .andExpect(jsonPath("$.naoInformado").value(1000.0));
        mvc.perform(get("/api/financeiro/lancamentos/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.descricao").value("Liquidação de cartão de débito: bruto R$ 100,00, taxa R$ 2,00"));
        // O limite continua sendo o total, não o saldo do tipo.
        enviar(post("/api/financeiro/liquidacoes-cartao"), TESOUREIRO, mapa("contaBancariaId", bancoA,
                "data", "2026-10-20", "bruto", "950", "taxa", "0", "tipoCartao", "CREDITO"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("BRUTO_EXCEDE_CARTAO_A_RECEBER"));
    }

    /** US-FINANCIAL-009: categorias com fluxo próprio não entram; anexo opcional. */
    @Test
    void registraLancamentoManualComAnexo() throws Exception {
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", bancoA, "data", "2026-10-15",
                "tipo", "DESPESA", "categoria", "DESPESAS_COMERCIAIS.TAXAS_CARTAO", "valor", "5", "descricao", "x"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("categoria"));
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", bancoA, "data", "2026-10-15",
                "tipo", "RECEITA", "categoria", "DESPESAS_OPERACIONAIS.AGUA", "valor", "5", "descricao", "x"))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", caixa, "data", "2026-10-15",
                "tipo", "DESPESA", "categoria", "DESPESAS_OPERACIONAIS.AGUA", "valor", "250", "descricao", "Água"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SALDO_INSUFICIENTE"));

        String pdf = Base64.getEncoder().encodeToString("%PDF-1.4".getBytes());
        long id = corpo(enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", bancoA,
                "data", "2026-10-15", "tipo", "DESPESA", "categoria", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA",
                "valor", "320.50", "descricao", "Conta de luz de setembro",
                "anexo", mapa("nome", "luz.pdf", "tipo", "application/pdf", "conteudoBase64", pdf)))
                .andExpect(status().isCreated())).get("id").asLong();
        assertThat(saldo(bancoA)).isEqualByComparingTo("679.50");
        mvc.perform(get("/api/financeiro/lancamentos/{id}", id).with(ADMIN))
                .andExpect(jsonPath("$.origemTipo").value("MANUAL"))
                .andExpect(jsonPath("$.natureza").value("DESPESA"))
                .andExpect(jsonPath("$.usuario").value("Carla"))
                .andExpect(jsonPath("$.temAnexo").value(true))
                .andExpect(jsonPath("$.podeEstornar").value(true))
                .andExpect(jsonPath("$.podeReclassificar").value(true));
        mvc.perform(get("/api/financeiro/lancamentos/{id}/anexo", id).with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
        assertThat(acoes("LancamentoFinanceiro", id)).containsExactly("LANCAMENTO_MANUAL_REGISTRADO");

        mvc.perform(get("/api/financeiro/categorias").with(TESOUREIRO))
                .andExpect(jsonPath("$[?(@.codigo == 'DESPESAS_COMERCIAIS.TAXAS_CARTAO')].permiteManual").value(false))
                .andExpect(jsonPath("$[?(@.codigo == 'DESPESAS_OPERACIONAIS.AGUA')].permiteManual").value(true));
    }

    /** US-FINANCIAL-005: extrato da conta com saldo anterior, saldo corrido e saldo final; filtros. */
    @Test
    void listaLancamentosComSaldoCorridoEFiltros() throws Exception {
        despesaManual(bancoA, "100", "DESPESAS_OPERACIONAIS.AGUA");
        transferir(caixa, bancoA, "60");
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", bancoA, "data", "2026-10-18",
                "tipo", "RECEITA", "categoria", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "valor", "40",
                "descricao", "Rifa beneficente")).andExpect(status().isCreated());

        mvc.perform(get("/api/financeiro/lancamentos").param("contaId", String.valueOf(bancoA))
                        .param("de", "2026-10-16").with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoAnterior").value(900.0))
                .andExpect(jsonPath("$.itens", hasSize(2)))
                .andExpect(jsonPath("$.itens[0].descricao").value("Rifa beneficente"))
                .andExpect(jsonPath("$.itens[0].saldoApos").value(940.0))
                .andExpect(jsonPath("$.itens[1].saldoApos").value(1000.0))
                .andExpect(jsonPath("$.itens[1].conciliado").value(false))
                .andExpect(jsonPath("$.saldoFinal").value(1000.0))
                .andExpect(jsonPath("$.temMais").value(false));

        mvc.perform(get("/api/financeiro/lancamentos").param("natureza", "DESPESA").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens", hasSize(1)))
                .andExpect(jsonPath("$.itens[0].valor").value(-100.0))
                .andExpect(jsonPath("$.itens[0].categorias[0]").value("Despesas operacionais › Água"));
        mvc.perform(get("/api/financeiro/lancamentos").param("categoria", "OUTRAS_RECEITAS").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens", hasSize(1)));
        mvc.perform(get("/api/financeiro/lancamentos").param("texto", "RIFA").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens", hasSize(1)));
        mvc.perform(get("/api/financeiro/lancamentos").param("valor", "60").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens[0].natureza").value("TRANSFERENCIA"));
        mvc.perform(get("/api/financeiro/lancamentos").param("origem", "MANUAL").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens", hasSize(2)));
        mvc.perform(get("/api/financeiro/lancamentos").with(OPERADOR)).andExpect(status().isForbidden());
    }

    /** US-FINANCIAL-010: estorno exato, correção ligada ao original, motivo obrigatório. */
    @Test
    void estornaECorrigeLancamentoPreservandoOOriginal() throws Exception {
        long original = despesaManual(bancoA, "100", "DESPESAS_OPERACIONAIS.AGUA");
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", original), TESOUREIRO, mapa("motivo", "errado"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("motivo"));

        JsonNode r = corpo(enviar(post("/api/financeiro/lancamentos/{id}/estorno", original), TESOUREIRO, mapa(
                "motivo", "Valor digitado errado na conta de água",
                "correcao", mapa("contaId", bancoA, "data", "2026-10-15", "tipo", "DESPESA",
                        "categoria", "DESPESAS_OPERACIONAIS.AGUA", "valor", "110", "descricao", "Conta de água")))
                .andExpect(status().isCreated()));
        long estorno = r.get("estornoId").asLong();
        long correcao = r.get("correcaoId").asLong();
        assertThat(saldo(bancoA)).isEqualByComparingTo("890");

        mvc.perform(get("/api/financeiro/lancamentos/{id}", original).with(TESOUREIRO))
                .andExpect(jsonPath("$.valor").value(-100.0))
                .andExpect(jsonPath("$.estornadoPorId").value(estorno))
                .andExpect(jsonPath("$.correcoes[0]").value(correcao))
                .andExpect(jsonPath("$.podeEstornar").value(false))
                .andExpect(jsonPath("$.podeReclassificar").value(false));
        mvc.perform(get("/api/financeiro/lancamentos/{id}", estorno).with(TESOUREIRO))
                .andExpect(jsonPath("$.natureza").value("ESTORNO"))
                .andExpect(jsonPath("$.valor").value(100.0))
                .andExpect(jsonPath("$.motivo").value("Valor digitado errado na conta de água"))
                .andExpect(jsonPath("$.estornaLancamentoId").value(original));
        mvc.perform(get("/api/financeiro/lancamentos/{id}", correcao).with(TESOUREIRO))
                .andExpect(jsonPath("$.corrigeLancamentoId").value(original));

        enviar(post("/api/financeiro/lancamentos/{id}/estorno", original), TESOUREIRO,
                mapa("motivo", "Tentando estornar de novo")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("LANCAMENTO_JA_ESTORNADO"));
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", estorno), ADMIN,
                mapa("motivo", "Estornar um estorno não pode")).andExpect(status().isConflict());
        assertThat(acoes("LancamentoFinanceiro", original)).containsExactly("LANCAMENTO_MANUAL_REGISTRADO",
                "LANCAMENTO_ESTORNADO");

        // Contribuições e vendas são corrigidas pelo próprio cancelamento.
        long contribuicao = jdbc.sql("""
                insert into lancamento_financeiro (data_financeira, origem_tipo, origem_id, descricao, criado_por,
                    criado_em, natureza) values ('2026-10-10', 'CONTRIBUICAO', 1, 'Recibo', 'sub', now(), 'RECEITA')
                returning id""").query(Long.class).single();
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", contribuicao), TESOUREIRO,
                mapa("motivo", "Não pode ser por aqui")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CORRIGIR_PELO_CANCELAMENTO"));
    }

    /** US-FINANCIAL-010: estornar a transferência que levou o dinheiro do caixa não deixa o banco travar. */
    @Test
    void estornaTransferenciaEConfereSaldoDoCaixa() throws Exception {
        long id = transferir(bancoA, caixa, "100");
        transferir(caixa, bancoA, "250");
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", id), TESOUREIRO,
                mapa("motivo", "Transferência lançada em duplicidade"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SALDO_INSUFICIENTE"));
    }

    /** US-FINANCIAL-021: só a classificação muda e o histórico fica visível. */
    @Test
    void reclassificaComHistorico() throws Exception {
        long id = despesaManual(bancoA, "100", "DESPESAS_OPERACIONAIS.AGUA");
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", id), TESOUREIRO, mapa("ordem", 0,
                "categoria", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "motivo", "Teste"))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", id), TESOUREIRO, mapa("ordem", 0,
                "categoria", "DESPESAS_OPERACIONAIS.INTERNET", "motivo", ""))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("motivo"));
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", id), ADMIN, mapa("ordem", 0,
                "categoria", "DESPESAS_OPERACIONAIS.INTERNET", "motivo", "Era a fatura da internet"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valor").value(-100.0))
                .andExpect(jsonPath("$.linhasCategoria[0].codigo").value("DESPESAS_OPERACIONAIS.INTERNET"))
                .andExpect(jsonPath("$.historico[0].de").value("Despesas operacionais › Água"))
                .andExpect(jsonPath("$.historico[0].para").value("Despesas operacionais › Internet"))
                .andExpect(jsonPath("$.historico[0].por").value("Daniel"))
                .andExpect(jsonPath("$.historico[0].motivo").value("Era a fatura da internet"));
        mvc.perform(get("/api/financeiro/lancamentos").param("categoria", "DESPESAS_OPERACIONAIS.AGUA").with(TESOUREIRO))
                .andExpect(jsonPath("$.itens", hasSize(0)));
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", id), OPERADOR, mapa("ordem", 0,
                "categoria", "DESPESAS_OPERACIONAIS.AGUA", "motivo", "x")).andExpect(status().isForbidden());
        long transferencia = transferir(caixa, bancoA, "10");
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", transferencia), TESOUREIRO, mapa("ordem", 0,
                "categoria", "DESPESAS_OPERACIONAIS.AGUA", "motivo", "Não é receita nem despesa"))
                .andExpect(status().isUnprocessableContent());
    }

    /** Contas de recebimento: o Administrador define onde entram o dinheiro e o PIX das vendas e contribuições. */
    @Test
    void administradorDefineAsContasDeRecebimento() throws Exception {
        mvc.perform(get("/api/financeiro/contas-recebimento").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dinheiro").doesNotExist())
                .andExpect(jsonPath("$.pix").doesNotExist())
                .andExpect(jsonPath("$.cartao.id").value(cartao));
        enviar(put("/api/financeiro/contas-recebimento"), TESOUREIRO, mapa("dinheiroContaId", caixa))
                .andExpect(status().isForbidden());
        enviar(put("/api/financeiro/contas-recebimento"), ADMIN, mapa("dinheiroContaId", bancoA, "pixContaId", caixa))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[*].campo").value(org.hamcrest.Matchers.containsInAnyOrder("dinheiroContaId",
                        "pixContaId")));
        enviar(put("/api/financeiro/contas-recebimento"), ADMIN, mapa("dinheiroContaId", caixa, "pixContaId", bancoA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dinheiro.nome").value("Caixa Secretaria"))
                .andExpect(jsonPath("$.pix.nome").value("Banco A"));
        assertThat(acoes("ContasRecebimento", 1)).containsExactly("CONTAS_RECEBIMENTO_ALTERADAS");

        // A conta de recebimento não é inativada nem excluída antes de o Administrador trocar o destino.
        long vazio = cadastrar(mapa("tipo", "CAIXA", "nome", "Caixa Eventos", "saldoInicial", 0,
                "dataCorte", "2026-10-01"));
        enviar(put("/api/financeiro/contas-recebimento"), ADMIN, mapa("dinheiroContaId", vazio, "pixContaId", bancoA))
                .andExpect(status().isOk());
        mvc.perform(post("/api/financeiro/contas/{id}/inativacao", vazio).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_DE_RECEBIMENTO"));
        mvc.perform(delete("/api/financeiro/contas/{id}", vazio).with(ADMIN))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONTA_DE_RECEBIMENTO"));
        enviar(put("/api/financeiro/contas-recebimento"), ADMIN, mapa("dinheiroContaId", caixa, "pixContaId", bancoA))
                .andExpect(status().isOk());
        mvc.perform(post("/api/financeiro/contas/{id}/inativacao", vazio).with(ADMIN)).andExpect(status().isOk());
    }

    /** US-FINANCIAL-015: saldos, conciliações pendentes por banco, período e cancelamentos recentes. */
    @Test
    void montaPainelDoTesoureiro() throws Exception {
        transferir(caixa, bancoA, "50");
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", bancoA, "data", "2026-10-18",
                "tipo", "RECEITA", "categoria", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "valor", "300",
                "descricao", "Bazar")).andExpect(status().isCreated());
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mes").value("2026-10"))
                .andExpect(jsonPath("$.saldos.cartaoAReceber.saldo").value(1000.0))
                .andExpect(jsonPath("$.saldos.subtotalBancos").value(1350.0))
                .andExpect(jsonPath("$.conciliacoes[0].naoConciliados").value(2))
                .andExpect(jsonPath("$.periodo.situacao").value("EM_ANDAMENTO"))
                .andExpect(jsonPath("$.periodo.itensTotal").isEmpty())
                .andExpect(jsonPath("$.resumoDoMes.receitas").value(300.0))
                .andExpect(jsonPath("$.receitaLiquida").value(300.0))
                .andExpect(jsonPath("$.mensalidades.previsto").value(0))
                .andExpect(jsonPath("$.intencoesPendentes").value(0))
                .andExpect(jsonPath("$.cancelamentosRecentes", hasSize(0)));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(VENDEDOR)).andExpect(status().isForbidden());
    }
}
