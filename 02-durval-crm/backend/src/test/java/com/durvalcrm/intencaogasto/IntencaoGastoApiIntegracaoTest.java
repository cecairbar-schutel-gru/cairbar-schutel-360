package com.durvalcrm.intencaogasto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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

/** Intenções de gasto (US-EXPENSE-001 a 009) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class IntencaoGastoApiIntegracaoTest {

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
    @Autowired JdbcClient jdbc;
    @Autowired RelogioDeTeste relogio;
    @Autowired EventoAuditoriaRepository auditoria;

    long caixa;
    long banco;
    long cafe;
    long suco;

    private static List<GrantedAuthority> papeis(String... roles) {
        return Arrays.stream(roles).map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
    }

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(papeis(roles));
    }

    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor SOLICITANTE = usuario("Ana", "VENDEDOR");
    private static final JwtRequestPostProcessor OUTRO_SOLICITANTE = usuario("Otávio", "VENDEDOR");
    private static final JwtRequestPostProcessor OPERADOR = usuario("Olga", "OPERADOR");
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-10-21T13:00:00Z");
        caixa = id(enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "saldoInicial", 50, "dataCorte", "2026-10-01")));
        banco = id(enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "BANCO", "nome", "Banco A", "banco",
                "Banco do Brasil", "agencia", "1234", "numeroConta", "56789-0", "saldoInicial", 1000,
                "dataCorte", "2026-10-01")));
        cafe = id(enviar(post("/api/estoque/cantina"), VENDEDOR, mapa("nome", "Café", "categoria", "Bebidas",
                "preco", "3.50")));
        suco = id(enviar(post("/api/estoque/cantina"), VENDEDOR, mapa("nome", "Suco", "categoria", "Bebidas",
                "preco", "5.00")));
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

    private int estoque(long produto) throws Exception {
        return corpo(mvc.perform(get("/api/estoque/produtos/{id}", produto).with(VENDEDOR))).get("saldo").asInt();
    }

    private List<String> acoes(Object id) {
        return auditoria.listarPorEntidade("IntencaoGasto", String.valueOf(id)).stream().map(EventoAuditoria::acao).toList();
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put((String) pares[i], pares[i + 1]);
        }
        return m;
    }

    private long pedirLimpeza(String valor) throws Exception {
        return id(enviar(post("/api/intencoes-gasto"), SOLICITANTE, mapa("descricao", "Produtos de limpeza",
                "categoria", "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "valor", valor, "justificativa",
                "Acabou o estoque de limpeza")));
    }

    private long pedirCompraCantina() throws Exception {
        return id(enviar(post("/api/intencoes-gasto"), SOLICITANTE, mapa("descricao", "Reposição da cantina",
                "categoria", "DESPESAS_COMERCIAIS.COMPRA_CANTINA", "valor", "100.00", "justificativa", "Evento de sábado",
                "itens", List.of(mapa("produtoId", cafe, "quantidade", 10), mapa("produtoId", suco, "quantidade", 5)))));
    }

    private void aprovarCompra(long id) throws Exception {
        enviar(post("/api/intencoes-gasto/{id}/aprovacao", id), TESOUREIRO, mapa("valor", "100.00", "categoria",
                "DESPESAS_COMERCIAIS.COMPRA_CANTINA", "meio", "PIX", "contaId", banco, "data", "2026-10-21"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("AGUARDANDO_RECEBIMENTO"));
    }

    /** US-EXPENSE-001, 002, 004 e 008: pedido com anexo, fila, aprovação ajustada e "Minhas intenções". */
    @Test
    void pedidoAprovadoComAjusteGeraADespesaNaContaDeOrigem() throws Exception {
        byte[] pdf = "%PDF-1.4 orçamento".getBytes();
        Map<String, Object> pedido = mapa("descricao", "Produtos de limpeza", "categoria",
                "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "valor", "180.00", "justificativa", "Acabou o estoque",
                "anexos", List.of(mapa("nome", "orcamento.pdf", "tipo", "application/pdf", "conteudoBase64",
                        Base64.getEncoder().encodeToString(pdf))));
        enviar(post("/api/intencoes-gasto"), OPERADOR, pedido).andExpect(status().isForbidden());
        enviar(post("/api/intencoes-gasto"), SOLICITANTE, mapa("descricao", "Taxas", "categoria",
                "DESPESAS_COMERCIAIS.TAXAS_CARTAO", "valor", "10", "justificativa", "x"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("categoria"));
        long id = id(enviar(post("/api/intencoes-gasto"), SOLICITANTE, pedido));

        mvc.perform(get("/api/intencoes-gasto/opcoes").with(SOLICITANTE))
                .andExpect(jsonPath("$.categorias[?(@.codigo == 'DESPESAS_COMERCIAIS.TAXAS_CARTAO')]").isEmpty())
                .andExpect(jsonPath("$.categorias[?(@.codigo == 'DESPESAS_COMERCIAIS.COMPRA_CANTINA')].compraCantina")
                        .value(true))
                .andExpect(jsonPath("$.produtos", hasSize(2)))
                .andExpect(jsonPath("$.contas", hasSize(0)));
        mvc.perform(get("/api/intencoes-gasto/opcoes").with(TESOUREIRO)).andExpect(jsonPath("$.contas", hasSize(2)));

        mvc.perform(get("/api/intencoes-gasto").with(SOLICITANTE)).andExpect(status().isForbidden());
        mvc.perform(get("/api/intencoes-gasto").with(TESOUREIRO))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].solicitanteNome").value("Ana"))
                .andExpect(jsonPath("$[0].anexos").value(1));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(jsonPath("$.intencoesPendentes").value(1));
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.categoriaNome").value("Despesas operacionais › Material de limpeza"))
                .andExpect(jsonPath("$.gastoNoMes").value(0))
                .andExpect(jsonPath("$.anexos[0].nome").value("orcamento.pdf"))
                .andExpect(jsonPath("$.acoes.decidir").value(true));
        mvc.perform(get("/api/intencoes-gasto/{id}/anexos/1", id).with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(content().bytes(pdf));
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(OUTRO_SOLICITANTE)).andExpect(status().isNotFound());
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(VENDEDOR)).andExpect(status().isNotFound());

        mvc.perform(post("/api/intencoes-gasto/minhas/visita").with(SOLICITANTE)).andExpect(status().isNoContent());
        relogio.ajustar("2026-10-21T15:00:00Z");

        // Ajuste de valor exige nota; dinheiro só sai de caixa.
        enviar(post("/api/intencoes-gasto/{id}/aprovacao", id), TESOUREIRO, mapa("valor", "172.50", "categoria",
                "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "meio", "PIX", "contaId", banco, "data", "2026-10-21"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("nota"));
        enviar(post("/api/intencoes-gasto/{id}/aprovacao", id), TESOUREIRO, mapa("valor", "172.50", "categoria",
                "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "meio", "DINHEIRO", "contaId", banco, "data", "2026-10-21",
                "nota", "preço final"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("contaId"));
        long lancamento = corpo(enviar(post("/api/intencoes-gasto/{id}/aprovacao", id), TESOUREIRO, mapa("valor",
                "172.50", "categoria", "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "meio", "PIX", "contaId", banco,
                "data", "2026-10-21", "nota", "preço final"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APROVADA"))).get("lancamentoId").asLong();

        assertThat(saldo(banco)).isEqualByComparingTo("827.50");
        assertThat(jdbc.sql("select origem_tipo || ':' || origem_id || ':' || descricao from lancamento_financeiro where id = ?")
                .param(lancamento).query(String.class).single())
                .isEqualTo("INTENCAO_GASTO:" + id + ":Intenção de gasto nº " + id + ": Produtos de limpeza");
        assertThat(jdbc.sql("select valor from lancamento_linha_categoria where lancamento_id = ?").param(lancamento)
                .query(BigDecimal.class).single()).isEqualByComparingTo("-172.50");

        enviar(post("/api/intencoes-gasto/{id}/rejeicao", id), ADMIN, mapa("motivo", "tarde"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("INTENCAO_EM_OUTRA_SITUACAO"));
        mvc.perform(get("/api/intencoes-gasto/minhas").with(SOLICITANTE))
                .andExpect(jsonPath("$[0].status").value("APROVADA"))
                .andExpect(jsonPath("$[0].valorSolicitado").value(180.0))
                .andExpect(jsonPath("$[0].valorAprovado").value(172.5))
                .andExpect(jsonPath("$[0].novidade").value(true));
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(SOLICITANTE))
                .andExpect(jsonPath("$.aprovacao.nota").value("preço final"))
                .andExpect(jsonPath("$.aprovacao.meio").value("PIX"))
                .andExpect(jsonPath("$.aprovacao.contaNome").value("Banco A"))
                .andExpect(jsonPath("$.gastoNoMes").doesNotExist())
                .andExpect(jsonPath("$.historico", hasSize(2)));
        mvc.perform(get("/api/intencoes-gasto/{id}", pedirLimpeza("10")).with(TESOUREIRO))
                .andExpect(jsonPath("$.gastoNoMes").value(172.5));
        assertThat(acoes(id)).contains("INTENCAO_GASTO_CRIADA", "INTENCAO_GASTO_APROVADA");
    }

    /** US-EXPENSE-005 e 009. */
    @Test
    void rejeicaoComMotivoEDesistenciaDoSolicitante() throws Exception {
        long rejeitada = pedirLimpeza("50");
        enviar(post("/api/intencoes-gasto/{id}/rejeicao", rejeitada), TESOUREIRO, mapa("motivo", " "))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/intencoes-gasto/{id}/rejeicao", rejeitada), TESOUREIRO, mapa("motivo", "Sem orçamento"))
                .andExpect(jsonPath("$.status").value("REJEITADA"))
                .andExpect(jsonPath("$.lancamentoId").doesNotExist());
        mvc.perform(get("/api/intencoes-gasto/{id}", rejeitada).with(SOLICITANTE))
                .andExpect(jsonPath("$.motivoRejeicao").value("Sem orçamento"))
                .andExpect(jsonPath("$.acoes.copiar").value(true));
        assertThat(saldo(banco)).isEqualByComparingTo("1000");

        long retirada = pedirLimpeza("30");
        enviar(post("/api/intencoes-gasto/{id}/retirada", retirada), OUTRO_SOLICITANTE, mapa("motivo", "não"))
                .andExpect(status().isNotFound());
        enviar(post("/api/intencoes-gasto/{id}/retirada", retirada), SOLICITANTE, mapa("motivo", "Ganhei os produtos"))
                .andExpect(jsonPath("$.status").value("CANCELADA"));
        mvc.perform(get("/api/intencoes-gasto").with(TESOUREIRO)).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get("/api/intencoes-gasto?status=TODAS").with(TESOUREIRO)).andExpect(jsonPath("$", hasSize(2)));
        mvc.perform(get("/api/intencoes-gasto/minhas?status=CANCELADA").with(SOLICITANTE))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    /** US-EXPENSE-001, 004 e 006: compra da cantina recebida sem divergência entra no estoque. */
    @Test
    void compraDaCantinaConferidaEntraNoEstoque() throws Exception {
        enviar(post("/api/intencoes-gasto"), SOLICITANTE, mapa("descricao", "Reposição", "categoria",
                "DESPESAS_COMERCIAIS.COMPRA_CANTINA", "valor", "100.00", "justificativa", "x"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("itens"));
        long id = pedirCompraCantina();

        // Caixa nunca negativo: o caixa tem R$ 50,00.
        enviar(post("/api/intencoes-gasto/{id}/aprovacao", id), TESOUREIRO, mapa("valor", "100.00", "categoria",
                "DESPESAS_COMERCIAIS.COMPRA_CANTINA", "meio", "DINHEIRO", "contaId", caixa, "data", "2026-10-21"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("SALDO_INSUFICIENTE"));
        aprovarCompra(id);

        mvc.perform(get("/api/intencoes-gasto/recebimentos").with(VENDEDOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].itens[0].produtoNome").value("Café"))
                .andExpect(jsonPath("$[0].itens[0].quantidade").value(10));
        mvc.perform(get("/api/intencoes-gasto/contadores").with(VENDEDOR))
                .andExpect(jsonPath("$.aguardandoRecebimento").value(1));
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(VENDEDOR))
                .andExpect(jsonPath("$.acoes.receber").value(true));

        enviar(post("/api/intencoes-gasto/{id}/recebimento", id), VENDEDOR, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 10), mapa("produtoId", suco, "quantidade", 5))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECEBIDA"));
        assertThat(estoque(cafe)).isEqualTo(10);
        assertThat(estoque(suco)).isEqualTo(5);
        assertThat(jdbc.sql("select count(*) from movimento_estoque where tipo = 'ENTRADA_COMPRA' and referencia_id = ?")
                .param(id).query(Long.class).single()).isEqualTo(2);
        enviar(post("/api/intencoes-gasto/{id}/recebimento", id), VENDEDOR, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 10), mapa("produtoId", suco, "quantidade", 5))))
                .andExpect(status().isConflict());
        assertThat(estoque(cafe)).isEqualTo(10);
    }

    /** US-EXPENSE-006 e 007: divergência bloqueia a entrada; correção com novo valor e cancelamento estornam. */
    @Test
    void divergenciaBloqueiaEntradaAteCorrecaoOuCancelamento() throws Exception {
        long id = pedirCompraCantina();
        aprovarCompra(id);
        assertThat(saldo(banco)).isEqualByComparingTo("900");

        enviar(post("/api/intencoes-gasto/{id}/recebimento", id), VENDEDOR, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 8), mapa("produtoId", suco, "quantidade", 5))))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("divergencia"));
        enviar(post("/api/intencoes-gasto/{id}/recebimento", id), VENDEDOR, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 8), mapa("produtoId", suco, "quantidade", 5)),
                "divergencia", "Vieram só 8 cafés"))
                .andExpect(jsonPath("$.status").value("DIVERGENTE"));
        assertThat(estoque(cafe)).isZero();
        mvc.perform(get("/api/intencoes-gasto?status=DIVERGENTE").with(TESOUREIRO))
                .andExpect(jsonPath("$[0].itens[0].quantidadeRecebida").value(8));

        enviar(post("/api/intencoes-gasto/{id}/correcao", id), TESOUREIRO, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 8), mapa("produtoId", suco, "quantidade", 5)),
                "valor", "93.00", "motivo", "Fornecedor abateu 2 cafés"))
                .andExpect(jsonPath("$.status").value("AGUARDANDO_RECEBIMENTO"));
        assertThat(saldo(banco)).isEqualByComparingTo("907");
        assertThat(jdbc.sql("select count(*) from lancamento_financeiro where origem_tipo = 'INTENCAO_GASTO' and origem_id = ?")
                .param(id).query(Long.class).single()).isEqualTo(3);

        enviar(post("/api/intencoes-gasto/{id}/recebimento", id), VENDEDOR, mapa("itens", List.of(
                mapa("produtoId", cafe, "quantidade", 8), mapa("produtoId", suco, "quantidade", 4)),
                "divergencia", "Um suco quebrado"))
                .andExpect(jsonPath("$.status").value("DIVERGENTE"));
        enviar(post("/api/intencoes-gasto/{id}/cancelamento", id), TESOUREIRO, mapa("motivo", "Devolvemos tudo"))
                .andExpect(jsonPath("$.status").value("CANCELADA"));
        assertThat(saldo(banco)).isEqualByComparingTo("1000");
        assertThat(estoque(cafe)).isZero();
        mvc.perform(get("/api/intencoes-gasto/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.historico[*].tipo").value(org.hamcrest.Matchers.contains("CRIADA", "APROVADA",
                        "DIVERGENTE", "CORRIGIDA", "DIVERGENTE", "CANCELADA")));
        assertThat(acoes(id)).contains("INTENCAO_GASTO_CORRIGIDA", "INTENCAO_GASTO_CANCELADA", "COMPRA_DIVERGENTE");
    }
}
