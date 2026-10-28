package com.durvalcrm.fechamento;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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

/** Fechamento mensal (US-CLOSING-001, 007, 008, 009, 013 e 014) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class FechamentoApiIntegracaoTest {

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
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-09-20T13:00:00Z");
        caixa = cadastrar(mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "saldoInicial", 200, "dataCorte", "2026-09-01"));
        banco = cadastrar(mapa("tipo", "BANCO", "nome", "Banco A", "banco", "Banco do Brasil", "agencia", "1234",
                "numeroConta", "56789-0", "saldoInicial", 1000, "dataCorte", "2026-09-01"));
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

    private ResultActions manual(long conta, String data, String tipo, String categoria, String valor, String descricao)
            throws Exception {
        return enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("contaId", conta, "data", data, "tipo", tipo,
                "categoria", categoria, "valor", valor, "descricao", descricao));
    }

    private long id(ResultActions r) throws Exception {
        return corpo(r.andExpect(status().isCreated())).get("id").asLong();
    }

    private String item(String codigo) {
        return "$.checklist.itens[?(@.codigo == '" + codigo + "')]";
    }

    private List<String> acoes() {
        return auditoria.listarPorEntidade("Periodo", "2026-09").stream().map(EventoAuditoria::acao).toList();
    }

    /** Jornada D (Spec §3): checklist → resolver pendências → fechar → trava → reabrir → fechar de novo. */
    @Test
    void fechaReabreEFechaDeNovoComNovaVersao() throws Exception {
        // Setembro: bazar no banco, conta de luz, depósito do caixa e uma intenção ainda sem decisão.
        long bazar = id(manual(banco, "2026-09-10", "RECEITA", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "1000", "Bazar"));
        long luz = id(manual(banco, "2026-09-12", "DESPESA", "DESPESAS_OPERACIONAIS.ENERGIA_ELETRICA", "100", "Luz"));
        long deposito = id(enviar(post("/api/financeiro/transferencias"), TESOUREIRO, mapa("contaOrigemId", caixa,
                "contaDestinoId", banco, "valor", "50", "data", "2026-09-15")));
        long intencao = id(enviar(post("/api/intencoes-gasto"), VENDEDOR, mapa("descricao", "Produtos de limpeza",
                "categoria", "DESPESAS_OPERACIONAIS.MATERIAL_LIMPEZA", "valor", "80", "justificativa", "Acabou")));
        relogio.ajustar("2026-10-20T13:00:00Z");

        // US-CLOSING-014: sem configuração, a janela é do dia 1 ao 7; Tesoureiro e Administrador a alteram.
        mvc.perform(get("/api/fechamentos/janela").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diaInicio").value(1))
                .andExpect(jsonPath("$.diaFim").value(7))
                .andExpect(jsonPath("$.aberta").value(false))
                .andExpect(jsonPath("$.inicio").value("2026-11-01"))
                .andExpect(jsonPath("$.alteradoPor").isEmpty());
        enviar(put("/api/fechamentos/janela"), OPERADOR, mapa("diaInicio", 18, "diaFim", 24))
                .andExpect(status().isForbidden());
        enviar(put("/api/fechamentos/janela"), TESOUREIRO, mapa("diaInicio", 15, "diaFim", 22))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("diaFim"));
        enviar(put("/api/fechamentos/janela"), TESOUREIRO, mapa("diaInicio", 18, "diaFim", 24))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aberta").value(true))
                .andExpect(jsonPath("$.inicio").value("2026-10-18"))
                .andExpect(jsonPath("$.alteradoPor").value("Carla"));
        assertThat(auditoria.listarPorEntidade("JanelaFechamento", "1")).extracting(EventoAuditoria::acao)
                .containsExactly("JANELA_FECHAMENTO_ALTERADA");

        // US-CLOSING-001: setembro é o mês a fechar; outubro está em andamento.
        mvc.perform(get("/api/fechamentos/painel").with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mesAtual").value("2026-10"))
                .andExpect(jsonPath("$.primeiroPeriodo").value("2026-09"))
                .andExpect(jsonPath("$.mesAFechar").value("2026-09"))
                .andExpect(jsonPath("$.checklist.itens", hasSize(5)))
                .andExpect(jsonPath("$.checklist.concluidos").value(2))
                .andExpect(jsonPath("$.checklist.podeFechar").value(false))
                .andExpect(jsonPath(item("CONCILIACAO") + ".concluido").value(contains(false)))
                .andExpect(jsonPath(item("CONCILIACAO") + ".detalhes[0]").value(contains("Banco A: nunca conciliada")))
                .andExpect(jsonPath(item("INTENCOES") + ".pendentes").value(contains(1)))
                .andExpect(jsonPath(item("ESTOQUE") + ".responsavel").value(contains("ADMINISTRADOR")))
                .andExpect(jsonPath(item("ESTOQUE") + ".concluido").value(contains(true)))
                .andExpect(jsonPath(item("EDITORAS") + ".concluido").value(contains(true)))
                .andExpect(jsonPath(item("CARTAO") + ".cartao.saldoNoFimDoMes").value(contains(0.0)))
                .andExpect(jsonPath(item("CARTAO") + ".concluido").value(contains(false)));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(jsonPath("$.periodo.mes").value("2026-09"))
                .andExpect(jsonPath("$.periodo.situacao").value("ABERTO"))
                .andExpect(jsonPath("$.periodo.itensConcluidos").value(2))
                .andExpect(jsonPath("$.periodo.itensTotal").value(5));
        mvc.perform(get("/api/fechamentos/painel").with(OPERADOR)).andExpect(status().isForbidden());
        enviar(post("/api/fechamentos/2026-09/fechamento"), TESOUREIRO, Map.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CHECKLIST_PENDENTE"));

        // Cada pendência se resolve na tela e no papel donos dela.
        enviar(post("/api/intencoes-gasto/{id}/rejeicao", intencao), TESOUREIRO, mapa("motivo", "Sem orçamento"))
                .andExpect(status().isOk());
        long sessao = corpo(enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-09-30",
                "saldoExtrato", "1950")).andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/conciliacoes/{id}/marcacoes", sessao), TESOUREIRO,
                mapa("lancamentoIds", List.of(bazar, luz, deposito), "marcado", true)).andExpect(status().isOk());
        enviar(post("/api/conciliacoes/{id}/conclusao", sessao), TESOUREIRO, Map.of()).andExpect(status().isOk());
        enviar(post("/api/fechamentos/2026-09/cartao"), OPERADOR, Map.of()).andExpect(status().isForbidden());
        enviar(post("/api/fechamentos/2026-10/cartao"), TESOUREIRO, Map.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FORA_DE_ORDEM"));
        enviar(post("/api/fechamentos/2026-09/cartao"), TESOUREIRO, Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.podeFechar").value(true))
                .andExpect(jsonPath("$.itens[?(@.codigo == 'CARTAO')].cartao.confirmadoPor").value(contains("Carla")));

        // Antes do fechamento, o demonstrativo é preliminar.
        mvc.perform(get("/api/fechamentos/2026-09/demonstrativo").with(ADMIN))
                .andExpect(jsonPath("$.situacao").value("PRELIMINAR"))
                .andExpect(jsonPath("$.versao").isEmpty());

        // US-CLOSING-014: fora da janela o botão fica desabilitado e o servidor recusa.
        enviar(put("/api/fechamentos/janela"), ADMIN, mapa("diaInicio", 21, "diaFim", 27)).andExpect(status().isOk());
        mvc.perform(get("/api/fechamentos/2026-09/checklist").with(TESOUREIRO))
                .andExpect(jsonPath("$.podeFechar").value(false))
                .andExpect(jsonPath("$.janela.aberta").value(false))
                .andExpect(jsonPath("$.janela.inicio").value("2026-10-21"));
        enviar(post("/api/fechamentos/2026-09/fechamento"), TESOUREIRO, Map.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("FORA_DA_JANELA_FECHAMENTO"));
        enviar(put("/api/fechamentos/janela"), ADMIN, mapa("diaInicio", 15, "diaFim", 21)).andExpect(status().isOk());

        // US-CLOSING-008: em ordem, pelo Tesoureiro ou pelo Administrador.
        enviar(post("/api/fechamentos/2026-10/fechamento"), TESOUREIRO, Map.of())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_EM_ANDAMENTO"));
        enviar(post("/api/fechamentos/2026-09/fechamento"), OPERADOR, Map.of()).andExpect(status().isForbidden());
        enviar(post("/api/fechamentos/2026-09/fechamento"), TESOUREIRO, mapa("nota", "Conferido com o extrato"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FECHADO"))
                .andExpect(jsonPath("$.eventos[*].evento").value(contains("CARTAO_CONFIRMADO", "FECHAMENTO")))
                .andExpect(jsonPath("$.eventos[1].texto").value("Conferido com o extrato"))
                .andExpect(jsonPath("$.versoes[0].versao").value(1));
        assertThat(jdbc.sql("select saldos_contas::text from periodo_snapshot where mes = '2026-09-01'")
                .query(String.class).single()).contains("Banco A").contains("1950");

        // US-CLOSING-007: versão fechada, separando resultado, transferências e obrigações.
        mvc.perform(get("/api/fechamentos/2026-09/demonstrativo").with(ADMIN))
                .andExpect(jsonPath("$.situacao").value("FECHADO"))
                .andExpect(jsonPath("$.versao").value(1))
                .andExpect(jsonPath("$.fechamento.nome").value("Carla"))
                .andExpect(jsonPath("$.totalReceitas.atual").value(1000.0))
                .andExpect(jsonPath("$.totalDespesas.atual").value(100.0))
                .andExpect(jsonPath("$.resultado.atual").value(900.0))
                .andExpect(jsonPath("$.receitas[0].nome").value("Outras receitas"))
                .andExpect(jsonPath("$.receitas[0].subcategorias[0].nome").value("Outras entradas"))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Banco A')].saldoInicial").value(contains(1000.0)))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Banco A')].entradas").value(contains(1000.0)))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Banco A')].saidas").value(contains(100.0)))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Banco A')].transferenciasEntrada").value(contains(50.0)))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Banco A')].saldoFinal").value(contains(1950.0)))
                .andExpect(jsonPath("$.contas[?(@.nome == 'Caixa Secretaria')].transferenciasSaida").value(contains(50.0)))
                .andExpect(jsonPath("$.totalEditoras").value(0))
                .andExpect(jsonPath("$.mensalidades.geradas").value(0));

        // Trava: nada entra em setembro; o estorno do que aconteceu lá cai hoje, no período aberto.
        manual(banco, "2026-09-25", "DESPESA", "DESPESAS_OPERACIONAIS.AGUA", "30", "Água")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FECHADO"));
        enviar(post("/api/financeiro/lancamentos/{id}/reclassificacao", luz), TESOUREIRO,
                mapa("ordem", 0, "categoria", "DESPESAS_OPERACIONAIS.AGUA", "motivo", "Era água"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FECHADO"));
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-09-30", "saldoExtrato", "1"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FECHADO"));
        long estorno = corpo(enviar(post("/api/financeiro/lancamentos/{id}/estorno", luz), TESOUREIRO,
                mapa("motivo", "Conta de luz em dobro")).andExpect(status().isCreated())).get("estornoId").asLong();
        assertThat(jdbc.sql("select data_financeira::text from lancamento_financeiro where id = ?").param(estorno)
                .query(String.class).single()).isEqualTo("2026-10-20");

        // US-CLOSING-013: outubro (preliminar) comparado com a versão fechada de setembro.
        mvc.perform(get("/api/fechamentos/2026-10/demonstrativo").with(TESOUREIRO))
                .andExpect(jsonPath("$.situacao").value("PRELIMINAR"))
                .andExpect(jsonPath("$.mesAnterior").value("2026-09"))
                .andExpect(jsonPath("$.anteriorFechado").value(true))
                .andExpect(jsonPath("$.receitas[0].valores.atual").value(0))
                .andExpect(jsonPath("$.receitas[0].valores.anterior").value(1000.0))
                .andExpect(jsonPath("$.receitas[0].valores.percentual").value(-100.0))
                .andExpect(jsonPath("$.receitas[0].valores.destaque").value(true))
                .andExpect(jsonPath("$.totalDespesas.atual").value(-100.0))
                .andExpect(jsonPath("$.totalDespesas.diferenca").value(-200.0));
        mvc.perform(get("/api/financeiro/painel-tesoureiro").with(TESOUREIRO))
                .andExpect(jsonPath("$.periodo.mes").value("2026-10"))
                .andExpect(jsonPath("$.periodo.situacao").value("EM_ANDAMENTO"));

        // US-CLOSING-009: só o Administrador, só o mais recente, com justificativa.
        enviar(post("/api/fechamentos/2026-09/reabertura"), TESOUREIRO, mapa("justificativa", "x".repeat(30)))
                .andExpect(status().isForbidden());
        enviar(post("/api/fechamentos/2026-09/reabertura"), ADMIN, mapa("justificativa", "Erro na luz"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("justificativa"));
        enviar(post("/api/fechamentos/2026-08/reabertura"), ADMIN, mapa("justificativa", "x".repeat(30)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("REABERTURA_FORA_DE_ORDEM"));
        enviar(post("/api/fechamentos/2026-09/reabertura"), ADMIN,
                mapa("justificativa", "Doação em dinheiro de 28/09 não foi lançada"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REABERTO"));
        mvc.perform(get("/api/fechamentos/reabertos").with(OPERADOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].mes").value("2026-09"))
                .andExpect(jsonPath("$[0].reabertoPor").value("Daniel"));

        // Reaberto: aceita lançamentos e volta pelo checklist (a confirmação do cartão foi desfeita).
        id(manual(caixa, "2026-09-28", "RECEITA", "OUTRAS_RECEITAS.OUTRAS_ENTRADAS", "200", "Doação esquecida"));
        mvc.perform(get("/api/fechamentos/painel").with(TESOUREIRO))
                .andExpect(jsonPath("$.mesAFechar").value("2026-09"))
                .andExpect(jsonPath("$.checklist.status").value("REABERTO"))
                .andExpect(jsonPath("$.checklist.reabertoPor").value("Daniel"))
                .andExpect(jsonPath("$.checklist.podeFechar").value(false))
                .andExpect(jsonPath(item("CARTAO") + ".concluido").value(contains(false)));
        enviar(post("/api/fechamentos/2026-09/cartao"), TESOUREIRO, Map.of()).andExpect(status().isOk());
        enviar(post("/api/fechamentos/2026-09/fechamento"), TESOUREIRO, Map.of())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versoes[*].versao").value(contains(2, 1)))
                .andExpect(jsonPath("$.eventos[*].evento").value(contains("CARTAO_CONFIRMADO", "FECHAMENTO",
                        "REABERTURA", "CARTAO_CONFIRMADO", "FECHAMENTO")));

        // A versão nova vale; a anterior fica guardada.
        mvc.perform(get("/api/fechamentos/2026-09/demonstrativo").with(ADMIN))
                .andExpect(jsonPath("$.versao").value(2))
                .andExpect(jsonPath("$.versaoVigente").value(true))
                .andExpect(jsonPath("$.totalReceitas.atual").value(1200.0));
        mvc.perform(get("/api/fechamentos/2026-09/demonstrativo").param("versao", "1").with(ADMIN))
                .andExpect(jsonPath("$.versao").value(1))
                .andExpect(jsonPath("$.versaoVigente").value(false))
                .andExpect(jsonPath("$.totalReceitas.atual").value(1000.0));
        mvc.perform(get("/api/fechamentos").with(ADMIN))
                .andExpect(jsonPath("$[0].mes").value("2026-10"))
                .andExpect(jsonPath("$[0].situacao").value("EM_ANDAMENTO"))
                .andExpect(jsonPath("$[1].situacao").value("FECHADO"))
                .andExpect(jsonPath("$[1].versoes").value(2))
                .andExpect(jsonPath("$[1].podeReabrir").value(true));
        mvc.perform(get("/api/fechamentos/reabertos").with(OPERADOR)).andExpect(jsonPath("$", hasSize(0)));
        assertThat(acoes()).containsExactly("PERIODO_CARTAO_CONFIRMADO", "PERIODO_FECHADO", "PERIODO_REABERTO",
                "PERIODO_CARTAO_CONFIRMADO", "PERIODO_FECHADO");
    }

    /** Remessa e transferência de saldo de editora também respeitam a trava. */
    @Test
    void travaRemessasNoMesFechado() throws Exception {
        relogio.ajustar("2026-10-05T13:00:00Z");
        enviar(post("/api/conciliacoes"), TESOUREIRO, mapa("contaId", banco, "dataFim", "2026-09-30", "saldoExtrato",
                "1000")).andExpect(status().isCreated());
        long sessao = jdbc.sql("select id from conciliacao where conta_id = ?").param(banco).query(Long.class).single();
        enviar(post("/api/conciliacoes/{id}/conclusao", sessao), TESOUREIRO, Map.of()).andExpect(status().isOk());
        enviar(post("/api/fechamentos/2026-09/cartao"), TESOUREIRO, Map.of()).andExpect(status().isOk());
        enviar(post("/api/fechamentos/2026-09/fechamento"), TESOUREIRO, Map.of()).andExpect(status().isOk());

        jdbc.sql("insert into editora (nome) values ('Editora Luz')").update();
        long editora = jdbc.sql("select id from editora where nome = 'Editora Luz'").query(Long.class).single();
        enviar(post("/api/editoras/remessas"), ADMIN, mapa("editoraId", editora, "recebidaEm", "2026-09-29",
                "itens", List.of())).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FECHADO"));
        enviar(post("/api/editoras/transferencias-saldo"), TESOUREIRO, mapa("editoraId", editora, "mes", "2026-09",
                "nota", "Combinado")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PERIODO_FECHADO"));
    }
}
