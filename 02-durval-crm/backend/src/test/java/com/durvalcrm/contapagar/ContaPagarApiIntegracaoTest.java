package com.durvalcrm.contapagar;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.doador.application.CepPort;
import java.math.BigDecimal;
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

/** Contas a pagar de ponta a ponta: cadastro, agenda, pagamento com despesa e estorno no Financeiro. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class ContaPagarApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    static final class RelogioDeTeste extends Clock {
        private Instant agora = Instant.parse("2026-10-21T13:00:00Z");
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
    @Autowired RelogioDeTeste relogio;

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
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-10-21T13:00:00Z");
        banco = id(enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "BANCO", "nome", "Banco A", "banco",
                "Banco do Brasil", "agencia", "1234", "numeroConta", "56789-0", "saldoInicial", 1000,
                "dataCorte", "2026-08-01")));
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, JwtRequestPostProcessor quem, Object corpo)
            throws Exception {
        return mvc.perform(req.with(quem).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)));
    }

    private long id(ResultActions r) throws Exception {
        return corpo(r.andExpect(status().isCreated())).get("id").asLong();
    }

    private JsonNode corpo(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private BigDecimal saldo(long conta) throws Exception {
        return new BigDecimal(corpo(mvc.perform(get("/api/financeiro/contas/{id}", conta).with(TESOUREIRO)))
                .get("saldo").asString());
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put((String) pares[i], pares[i + 1]);
        }
        return m;
    }

    private long cadastrarLuz() throws Exception {
        return id(enviar(post("/api/contas-pagar"), TESOUREIRO, mapa("descricao", "Conta de luz", "favorecido", "Enel",
                "categoria", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "valorPrevisto", "180.00", "recorrencia",
                "MENSAL", "primeiroVencimento", "2026-09-15", "contaFinanceiraId", banco)));
    }

    @Test
    void pagamentoGeraDespesaEEstornoReabreOVencimento() throws Exception {
        long luz = cadastrarLuz();

        // Setembro e outubro vencidos; novembro a vencer.
        mvc.perform(get("/api/contas-pagar/parcelas").param("de", "2026-10-01").param("ate", "2026-11-30")
                        .param("incluirVencidas", "true").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].vencimento").value("2026-09-15"))
                .andExpect(jsonPath("$[0].situacao").value("VENCIDA"))
                .andExpect(jsonPath("$[2].situacao").value("A_VENCER"));
        mvc.perform(get("/api/contas-pagar/resumo").with(ADMIN))
                .andExpect(jsonPath("$.vencidas").value(2))
                .andExpect(jsonPath("$.valorVencidas").value(360.0));

        // O valor pago pode diferir do previsto.
        JsonNode pago = corpo(enviar(post("/api/contas-pagar/pagamentos"), TESOUREIRO, mapa("contaPagarId", luz,
                "vencimento", "2026-09-15", "pagoEm", "2026-10-20", "valor", "192.37", "contaId", banco,
                "chaveIdempotencia", "luz-set")).andExpect(status().isCreated()));
        long lancamento = pago.get("lancamentoId").asLong();
        org.assertj.core.api.Assertions.assertThat(saldo(banco)).isEqualByComparingTo("807.63");
        mvc.perform(get("/api/financeiro/lancamentos/{id}", lancamento).with(TESOUREIRO))
                .andExpect(jsonPath("$.origemTipo").value("CONTA_PAGAR"));

        // Idempotente pela chave; vencimento já pago é recusado.
        enviar(post("/api/contas-pagar/pagamentos"), TESOUREIRO, mapa("contaPagarId", luz, "vencimento", "2026-09-15",
                "pagoEm", "2026-10-20", "valor", "192.37", "contaId", banco, "chaveIdempotencia", "luz-set"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(pago.get("id").asLong()));
        enviar(post("/api/contas-pagar/pagamentos"), ADMIN, mapa("contaPagarId", luz, "vencimento", "2026-09-15",
                "pagoEm", "2026-10-20", "valor", "10", "contaId", banco, "chaveIdempotencia", "outra"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VENCIMENTO_JA_PAGO"));
        // Data que não é vencimento da conta.
        enviar(post("/api/contas-pagar/pagamentos"), ADMIN, mapa("contaPagarId", luz, "vencimento", "2026-10-16",
                "pagoEm", "2026-10-20", "valor", "10", "contaId", banco))
                .andExpect(status().isUnprocessableContent());

        mvc.perform(get("/api/contas-pagar/{id}", luz).with(TESOUREIRO))
                .andExpect(jsonPath("$.pagamentos", hasSize(1)))
                .andExpect(jsonPath("$.emAberto[0]").value("2026-10-15"));

        // A recorrência não muda mais e a conta não pode ser excluída.
        enviar(put("/api/contas-pagar/{id}", luz), TESOUREIRO, mapa("descricao", "Conta de luz", "categoria",
                "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "valorPrevisto", "180.00", "recorrencia", "ANUAL",
                "primeiroVencimento", "2026-09-15")).andExpect(status().isConflict());
        mvc.perform(delete("/api/contas-pagar/{id}", luz).with(TESOUREIRO)).andExpect(status().isConflict());

        // Estorno no Financeiro reabre o vencimento.
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", lancamento), TESOUREIRO,
                mapa("motivo", "Pagamento feito na conta errada")).andExpect(status().isCreated());
        mvc.perform(get("/api/contas-pagar/parcelas").param("de", "2026-09-01").param("ate", "2026-09-30")
                        .with(TESOUREIRO))
                .andExpect(jsonPath("$[0].situacao").value("VENCIDA"));
        mvc.perform(get("/api/contas-pagar/{id}", luz).with(TESOUREIRO))
                .andExpect(jsonPath("$.pagamentos[0].estornadoEm").isNotEmpty());

        // Encerrada, deixa de ter vencimentos em aberto.
        mvc.perform(post("/api/contas-pagar/{id}/encerramento", luz).with(TESOUREIRO))
                .andExpect(jsonPath("$.ativa").value(false));
        mvc.perform(get("/api/contas-pagar/resumo").with(TESOUREIRO)).andExpect(jsonPath("$.vencidas").value(0));
    }

    @Test
    void contaUnicaPagaFicaQuitadaEOEstornoAReativa() throws Exception {
        long aluguel = id(enviar(post("/api/contas-pagar"), TESOUREIRO, mapa("descricao", "Aluguel do salão",
                "categoria", "DESPESAS_OPERACIONAIS.ALUGUEL", "valorPrevisto", "500.00", "recorrencia", "UNICA",
                "primeiroVencimento", "2026-10-20", "contaFinanceiraId", banco)));
        long lancamento = corpo(enviar(post("/api/contas-pagar/pagamentos"), TESOUREIRO, mapa("contaPagarId", aluguel,
                "vencimento", "2026-10-20", "pagoEm", "2026-10-20", "valor", "500.00", "contaId", banco))
                .andExpect(status().isCreated())).get("lancamentoId").asLong();
        mvc.perform(get("/api/contas-pagar/{id}", aluguel).with(TESOUREIRO))
                .andExpect(jsonPath("$.conta.ativa").value(false))
                .andExpect(jsonPath("$.quitada").value(true));
        mvc.perform(get("/api/contas-pagar").param("situacao", "TODAS").with(TESOUREIRO))
                .andExpect(jsonPath("$[0].quitada").value(true));
        // O pagamento continua na agenda.
        mvc.perform(get("/api/contas-pagar/parcelas").param("de", "2026-10-01").param("ate", "2026-10-31")
                        .with(TESOUREIRO))
                .andExpect(jsonPath("$[0].situacao").value("PAGA"));

        enviar(post("/api/financeiro/lancamentos/{id}/estorno", lancamento), TESOUREIRO,
                mapa("motivo", "Pago em duplicidade")).andExpect(status().isCreated());
        mvc.perform(get("/api/contas-pagar/{id}", aluguel).with(TESOUREIRO))
                .andExpect(jsonPath("$.conta.ativa").value(true))
                .andExpect(jsonPath("$.quitada").value(false))
                .andExpect(jsonPath("$.emAberto[0]").value("2026-10-20"));
    }

    @Test
    void soATesourariaAcessaEContaSemPagamentoPodeSerExcluida() throws Exception {
        mvc.perform(get("/api/contas-pagar").with(VENDEDOR)).andExpect(status().isForbidden());
        enviar(post("/api/contas-pagar"), TESOUREIRO, mapa("descricao", "", "categoria",
                "DESPESAS_COMERCIAIS.REPASSE_EDITORAS", "valorPrevisto", "0", "recorrencia", "MENSAL"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros", hasSize(4)));
        long luz = cadastrarLuz();
        mvc.perform(get("/api/contas-pagar").with(ADMIN))
                .andExpect(jsonPath("$[0].conta.descricao").value("Conta de luz"))
                .andExpect(jsonPath("$[0].categoriaNome").value("Despesas operacionais › Energia elétrica"))
                .andExpect(jsonPath("$[0].proximoVencimento").value("2026-09-15"));
        mvc.perform(delete("/api/contas-pagar/{id}", luz).with(ADMIN)).andExpect(status().isNoContent());
        mvc.perform(get("/api/contas-pagar").with(ADMIN)).andExpect(jsonPath("$", hasSize(0)));
    }
}
