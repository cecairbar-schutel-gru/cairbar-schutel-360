package com.durvalcrm.editora;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.doador.application.CepPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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

/** Editoras (US-PUBLISHER-001 a 010) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class EditoraApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    static final class RelogioDeTeste extends Clock {
        private Instant agora = Instant.parse("2026-10-01T13:00:00Z");
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

    private static final String CNPJ = "11.222.333/0001-81";

    long caixa;
    long banco;
    long editora;
    long oCaminho;

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
        relogio.ajustar("2026-10-01T13:00:00Z");
        caixa = jdbc.sql("insert into conta_financeira (codigo, nome, tipo) values ('cx-2', 'Caixa Cantina', 'CAIXA') returning id")
                .query(Long.class).single();
        banco = jdbc.sql("insert into conta_financeira (codigo, nome, tipo) values ('banco-a', 'Banco A', 'BANCO') returning id")
                .query(Long.class).single();
        enviar(put("/api/financeiro/contas-recebimento"), ADMIN, mapa("dinheiroContaId", caixa, "pixContaId", banco))
                .andExpect(status().isOk());
        editora = corpo(enviar(post("/api/editoras"), ADMIN, mapa("nome", "Editora Luz", "cnpj", CNPJ,
                "contatoNome", "Marta", "telefone", "(11) 98765-4321", "email", "contato@luz.com.br",
                "chavePix", "contato@luz.com.br")).andExpect(status().isCreated())).get("id").asLong();
        oCaminho = corpo(enviar(post("/api/estoque/livros"), ADMIN, mapa("titulo", "O Caminho", "autor", "André Luiz",
                "isbn", "9788573287868", "editoraId", editora, "repassePadrao", "40", "preco", "50.00"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    /** US-PUBLISHER-001: CNPJ validado e único; o Vendedor (ou o Administrador) cadastra; inativa não recebe remessa. */
    @Test
    void cadastroDeEditoraValidaCnpjEBloqueiaRemessaDeInativa() throws Exception {
        enviar(post("/api/editoras"), TESOUREIRO, mapa("nome", "Outra", "cnpj", CNPJ)).andExpect(status().isForbidden());
        enviar(post("/api/editoras"), VENDEDOR, mapa("nome", "Outra", "cnpj", "11.444.777/0001-61"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/editoras/saldos").with(VENDEDOR)).andExpect(status().isForbidden());
        enviar(post("/api/editoras"), ADMIN, mapa("nome", "Outra", "cnpj", "11.222.333/0001-82"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("cnpj"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("CNPJ inválido."));
        enviar(post("/api/editoras"), ADMIN, mapa("nome", "Outra", "cnpj", "11222333000181"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value("Já existe uma editora com este CNPJ."));

        mvc.perform(get("/api/editoras/{id}", editora).with(TESOUREIRO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.editora.cnpj").value("11222333000181"))
                .andExpect(jsonPath("$.editora.telefone").value("11987654321"))
                .andExpect(jsonPath("$.saldoDevido").value(0))
                .andExpect(jsonPath("$.possuiRemessas").value(false));

        enviar(post("/api/editoras/{id}/inativacao", editora), ADMIN, mapa()).andExpect(status().isOk());
        enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-01", 3, null))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("EDITORA_INATIVA"));
        mvc.perform(get("/api/editoras").with(TESOUREIRO)).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nome").value("Outra"));
        mvc.perform(get("/api/editoras").param("situacao", "TODAS").with(TESOUREIRO))
                .andExpect(jsonPath("$[0].ativa").value(false));
    }

    /**
     * US-PUBLISHER-003, 005, 006, 007, 008 e 010 com o exemplo da US-PUBLISHER-008: obrigações de
     * R$ 60,00 (venda em 05/10) e R$ 17,50 (12/10); pagamento de R$ 70,00 em 31/10 deixa R$ 7,50.
     */
    @Test
    void remessaVendaDevolucaoPagamentoParcialApuracaoETransferenciaDeSaldo() throws Exception {
        JsonNode r1 = corpo(enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-01", 3, null))
                .andExpect(status().isCreated()));
        assertThat(r1.get("codigo").asString()).isEqualTo("R-2026-0001");
        long remessa1 = r1.get("id").asLong();
        assertThat(estoque(oCaminho)).isEqualTo(3);

        relogio.ajustar("2026-10-05T15:00:00Z");
        long venda1 = vender(3);
        relogio.ajustar("2026-10-10T15:00:00Z");
        long remessa2 = corpo(enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-10", 5, "35"))
                .andExpect(jsonPath("$.codigo").value("R-2026-0002"))).get("id").asLong();
        relogio.ajustar("2026-10-12T15:00:00Z");
        vender(1);

        // Itens e percentuais não mudam; vendida, a remessa não pode mais ser cancelada.
        enviar(post("/api/editoras/remessas/{id}/cancelamento", remessa1), ADMIN, mapa("motivo", "Erro de digitação"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("REMESSA_COM_MOVIMENTOS"));
        mvc.perform(get("/api/editoras/remessas/{id}", remessa1).with(TESOUREIRO))
                .andExpect(jsonPath("$.situacao").value("ENCERRADA"))
                .andExpect(jsonPath("$.podeCancelar").value(false))
                .andExpect(jsonPath("$.itens[0].vendida").value(3))
                .andExpect(jsonPath("$.itens[0].restante").value(0))
                .andExpect(jsonPath("$.itens[0].obrigacoes").value(60.0));

        // US-PUBLISHER-005: devolução por remessa, sem lançamento.
        long lancamentosAntes = lancamentos();
        enviar(post("/api/editoras/remessas/{id}/devolucoes", remessa2), ADMIN, devolucao("2026-10-12", 5))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value("Restam só 4 unidade(s) de O Caminho nesta remessa."));
        long devolucao = corpo(enviar(post("/api/editoras/remessas/{id}/devolucoes", remessa2), ADMIN,
                devolucao("2026-10-12", 2)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.remessaCodigo").value("R-2026-0002"))
                .andExpect(jsonPath("$.itens[0].quantidade").value(2))).get("id").asLong();
        assertThat(lancamentos()).isEqualTo(lancamentosAntes);
        assertThat(estoque(oCaminho)).isEqualTo(2);
        mvc.perform(get("/api/editoras/devolucoes/{id}", devolucao).with(TESOUREIRO))
                .andExpect(jsonPath("$.editoraNome").value("Editora Luz"));
        mvc.perform(get("/api/editoras/remessas/{id}", remessa2).with(TESOUREIRO))
                .andExpect(jsonPath("$.situacao").value("ABERTA"))
                .andExpect(jsonPath("$.itens[0].recebida").value(5))
                .andExpect(jsonPath("$.itens[0].repassePercentual").value(35.0))
                .andExpect(jsonPath("$.itens[0].vendida").value(1))
                .andExpect(jsonPath("$.itens[0].devolvida").value(2))
                .andExpect(jsonPath("$.itens[0].restante").value(2))
                .andExpect(jsonPath("$.devolucoes.length()").value(1));

        // US-PUBLISHER-006
        mvc.perform(get("/api/editoras/saldos").with(TESOUREIRO))
                .andExpect(jsonPath("$.total").value(77.5))
                .andExpect(jsonPath("$.editoras[0].obrigacaoMaisAntiga").value("2026-10-05"));

        // US-PUBLISHER-008: prévia e pagamento parcial.
        relogio.ajustar("2026-10-31T15:00:00Z");
        mvc.perform(get("/api/editoras/pagamentos/previa").param("editoraId", String.valueOf(editora))
                .param("valor", "70.00").with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(77.5))
                .andExpect(jsonPath("$.alocacoes[0].valorAlocado").value(60.0))
                .andExpect(jsonPath("$.alocacoes[1].valorAlocado").value(10.0))
                .andExpect(jsonPath("$.alocacoes[1].restante").value(7.5))
                .andExpect(jsonPath("$.saldoDepois").value(7.5));
        enviar(post("/api/editoras/pagamentos"), ADMIN, pagamento("70.00")).andExpect(status().isForbidden());
        JsonNode pago = corpo(enviar(post("/api/editoras/pagamentos"), TESOUREIRO, pagamento("70.00"))
                .andExpect(status().isCreated()));
        long pagamentoId = pago.get("id").asLong();
        long lancamento = pago.get("lancamentoId").asLong();
        enviar(post("/api/editoras/pagamentos"), TESOUREIRO, pagamento("10.00"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value("O valor passa o saldo devido de R$ 7,50."));
        assertThat(jdbc.sql("select data_financeira::text from lancamento_financeiro where id = ?").param(lancamento)
                .query(String.class).single()).isEqualTo("2026-10-31");
        assertThat(jdbc.sql("select valor from lancamento_linha_categoria where lancamento_id = ? and categoria_codigo = ?")
                .params(lancamento, "DESPESAS_COMERCIAIS.REPASSE_EDITORAS").query(BigDecimal.class).single())
                .isEqualByComparingTo("-70.00");
        mvc.perform(get("/api/editoras/{id}/saldo", editora).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(7.5))
                .andExpect(jsonPath("$.obrigacoes[0].status").value("PAGA"))
                .andExpect(jsonPath("$.obrigacoes[0].origemNumero").value(numero(venda1)))
                .andExpect(jsonPath("$.obrigacoes[1].status").value("PARCIALMENTE_PAGA"))
                .andExpect(jsonPath("$.obrigacoes[1].valorPago").value(10.0))
                .andExpect(jsonPath("$.obrigacoes[1].valorAberto").value(7.5));
        mvc.perform(get("/api/editoras/pagamentos/{id}", pagamentoId).with(TESOUREIRO))
                .andExpect(jsonPath("$.valor").value(70.0))
                .andExpect(jsonPath("$.alocacoes.length()").value(2));

        // US-PUBLISHER-007
        mvc.perform(get("/api/editoras/{id}/apuracao", editora).param("mes", "2026-10").with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoInicial").value(0))
                .andExpect(jsonPath("$.obrigacoesVendas").value(77.5))
                .andExpect(jsonPath("$.pagamentos").value(70.0))
                .andExpect(jsonPath("$.saldoFinal").value(7.5))
                .andExpect(jsonPath("$.estoque[0].remessaCodigo").value("R-2026-0001"))
                .andExpect(jsonPath("$.estoque[0].recebida").value(3))
                .andExpect(jsonPath("$.estoque[0].vendida").value(3))
                .andExpect(jsonPath("$.estoque[1].devolvida").value(2))
                .andExpect(jsonPath("$.estoque[1].fim").value(2))
                .andExpect(jsonPath("$.vendas.length()").value(2))
                .andExpect(jsonPath("$.devolucoes[0].quantidade").value(2));

        // US-PUBLISHER-010: saldo no fim do mês pago ou transferido formalmente.
        mvc.perform(get("/api/editoras/fechamento").param("mes", "2026-10").with(TESOUREIRO))
                .andExpect(jsonPath("$.concluido").value(false))
                .andExpect(jsonPath("$.editoras[0].situacao").value("PENDENTE"))
                .andExpect(jsonPath("$.editoras[0].saldoNoFimDoMes").value(7.5));
        enviar(post("/api/editoras/transferencias-saldo"), TESOUREIRO, mapa("editoraId", editora, "mes", "2026-10"))
                .andExpect(status().isUnprocessableContent());
        enviar(post("/api/editoras/transferencias-saldo"), TESOUREIRO, mapa("editoraId", editora, "mes", "2026-10",
                "nota", "Combinado com a editora pagar em 15/11")).andExpect(status().isCreated());
        mvc.perform(get("/api/editoras/fechamento").param("mes", "2026-10").with(TESOUREIRO))
                .andExpect(jsonPath("$.concluido").value(true))
                .andExpect(jsonPath("$.editoras[0].situacao").value("TRANSFERIDA"));
        mvc.perform(get("/api/editoras/{id}/apuracao", editora).param("mes", "2026-11").with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoInicial").value(7.5))
                .andExpect(jsonPath("$.transferenciaAnterior.nota").value("Combinado com a editora pagar em 15/11"));

        // Estorno da despesa no Financeiro (US-FINANCIAL-010) reabre as obrigações cobertas.
        enviar(post("/api/financeiro/lancamentos/{id}/estorno", lancamento), TESOUREIRO,
                mapa("motivo", "Pagamento feito na conta errada")).andExpect(status().isCreated());
        mvc.perform(get("/api/editoras/{id}/saldo", editora).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(77.5))
                .andExpect(jsonPath("$.obrigacoes[0].status").value("ABERTA"))
                .andExpect(jsonPath("$.obrigacoes[1].valorAberto").value(17.5));
        mvc.perform(get("/api/editoras/pagamentos/{id}", pagamentoId).with(TESOUREIRO))
                .andExpect(jsonPath("$.estornadoEm").isNotEmpty());
    }

    /** O que já foi pago de uma venda depois cancelada vira crédito, aplicado no próximo pagamento. */
    @Test
    void creditoDeVendaCanceladaEhAplicadoNoProximoPagamento() throws Exception {
        enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-01", 5, null)).andExpect(status().isCreated());
        long venda = vender(1);
        enviar(post("/api/editoras/pagamentos"), TESOUREIRO, pagamento("20.00")).andExpect(status().isCreated());
        enviar(post("/api/vendas/{id}/cancelamento", venda), VENDEDOR, mapa("motivo", "Cliente desistiu"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/editoras/{id}/saldo", editora).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(-20.0))
                .andExpect(jsonPath("$.creditoDisponivel").value(20.0))
                .andExpect(jsonPath("$.obrigacoes[0].status").value("ESTORNADA"));

        vender(2);
        mvc.perform(get("/api/editoras/pagamentos/previa").param("editoraId", String.valueOf(editora))
                .param("valor", "20.00").with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(20.0))
                .andExpect(jsonPath("$.creditoAplicado").value(20.0))
                .andExpect(jsonPath("$.alocacoes[0].valorAlocado").value(40.0));
        enviar(post("/api/editoras/pagamentos"), TESOUREIRO, pagamento("20.00"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/editoras/{id}/saldo", editora).with(TESOUREIRO))
                .andExpect(jsonPath("$.saldoDevido").value(0))
                .andExpect(jsonPath("$.creditoDisponivel").value(0))
                .andExpect(jsonPath("$.obrigacoes[1].status").value("PAGA"));
    }

    /** Remessa com erro é cancelada enquanto nenhuma unidade se moveu: a entrada é estornada no estoque. */
    @Test
    void cancelaRemessaSemMovimentos() throws Exception {
        long id = corpo(enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-01", 4, "30"))
                .andExpect(status().isCreated())).get("id").asLong();
        enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-02", 1, null))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].mensagem").value("A data de recebimento não pode ser futura."));
        enviar(post("/api/editoras/remessas"), ADMIN, remessa("2026-10-01", 0, "120"))
                .andExpect(status().isUnprocessableContent());
        assertThat(estoque(oCaminho)).isEqualTo(4);
        enviar(post("/api/editoras/remessas/{id}/cancelamento", id), ADMIN, mapa("motivo", "Quantidade errada"))
                .andExpect(status().isOk());
        assertThat(estoque(oCaminho)).isZero();
        mvc.perform(get("/api/editoras/remessas/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.situacao").value("CANCELADA"))
                .andExpect(jsonPath("$.motivoCancelamento").value("Quantidade errada"));
        enviar(post("/api/editoras/remessas/{id}/devolucoes", id), ADMIN, devolucao("2026-10-01", 1))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("REMESSA_CANCELADA"));
    }

    /**
     * Só a Tesouraria pede livros; o Vendedor registra a remessa contra o pedido, que passa a recebido com
     * a conferência por título. Cancelar a remessa reabre o pedido; pedido aberto pode ser cancelado.
     */
    @Test
    void pedidoDeLivrosRecebidoPelaRemessaDoVendedor() throws Exception {
        Map<String, Object> pedido = mapa("editoraId", editora, "observacao", "Para a feira",
                "itens", List.of(mapa("produtoId", oCaminho, "quantidade", 5)));
        enviar(post("/api/editoras/pedidos"), VENDEDOR, pedido).andExpect(status().isForbidden());
        long id = corpo(enviar(post("/api/editoras/pedidos"), TESOUREIRO, pedido)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ABERTO"))
                .andExpect(jsonPath("$.pedidoPor").value("Carla"))
                .andExpect(jsonPath("$.itens[0].pedida").value(5))
                .andExpect(jsonPath("$.itens[0].recebida").doesNotExist())).get("id").asLong();
        enviar(post("/api/editoras/pedidos"), ADMIN, mapa("editoraId", editora, "itens",
                List.of(mapa("produtoId", oCaminho, "quantidade", 0))))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(get("/api/editoras/pedidos").param("situacao", "ABERTO").with(VENDEDOR))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].unidades").value(5));

        Map<String, Object> recebida = remessa("2026-10-01", 4, null);
        recebida.put("pedidoId", id);
        long remessaId = corpo(enviar(post("/api/editoras/remessas"), VENDEDOR, recebida)
                .andExpect(status().isCreated())).get("id").asLong();
        mvc.perform(get("/api/editoras/pedidos/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.status").value("RECEBIDO"))
                .andExpect(jsonPath("$.remessaCodigo").value("R-2026-0001"))
                .andExpect(jsonPath("$.itens[0].pedida").value(5))
                .andExpect(jsonPath("$.itens[0].recebida").value(4));
        enviar(post("/api/editoras/remessas"), VENDEDOR, recebida)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("PEDIDO_NAO_ABERTO"));
        assertThat(estoque(oCaminho)).isEqualTo(4);

        enviar(post("/api/editoras/remessas/{id}/cancelamento", remessaId), VENDEDOR, mapa("motivo", "Registro errado"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/editoras/pedidos/{id}", id).with(TESOUREIRO))
                .andExpect(jsonPath("$.status").value("ABERTO"))
                .andExpect(jsonPath("$.remessaId").doesNotExist());

        enviar(post("/api/editoras/pedidos/{id}/cancelamento", id), VENDEDOR, mapa("motivo", "Desistimos"))
                .andExpect(status().isForbidden());
        enviar(post("/api/editoras/pedidos/{id}/cancelamento", id), ADMIN, mapa("motivo", "Desistimos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADO"));
    }

    private Map<String, Object> remessa(String data, int quantidade, String percentual) {
        return mapa("editoraId", editora, "recebidaEm", data, "numeroDocumento", "NF 123", "itens",
                List.of(mapa("produtoId", oCaminho, "quantidade", quantidade, "repassePercentual",
                        percentual == null ? null : new BigDecimal(percentual))));
    }

    private Map<String, Object> devolucao(String data, int quantidade) {
        return mapa("devolvidaEm", data, "observacao", "Sem giro", "itens",
                List.of(mapa("produtoId", oCaminho, "quantidade", quantidade)));
    }

    private Map<String, Object> pagamento(String valor) {
        return mapa("editoraId", editora, "pagoEm", LocalDate.ofInstant(relogio.instant(), relogio.getZone())
                .toString(), "valor", new BigDecimal(valor), "contaId", banco, "meio", "PIX", "chaveIdempotencia",
                UUID.randomUUID().toString());
    }

    private long vender(int quantidade) throws Exception {
        String total = new BigDecimal("50.00").multiply(BigDecimal.valueOf(quantidade)).toPlainString();
        return corpo(enviar(post("/api/vendas"), VENDEDOR, mapa("itens",
                List.of(mapa("produtoId", oCaminho, "quantidade", quantidade, "precoUnitario", new BigDecimal("50.00"))),
                "pagamentos", List.of(mapa("meio", "DINHEIRO", "valor", new BigDecimal(total))),
                "chaveIdempotencia", UUID.randomUUID().toString())).andExpect(status().isCreated())).get("id").asLong();
    }

    private long numero(long venda) {
        return jdbc.sql("select numero from venda where id = ?").param(venda).query(Long.class).single();
    }

    private long lancamentos() {
        return jdbc.sql("select count(*) from lancamento_financeiro").query(Long.class).single();
    }

    private ResultActions enviar(MockHttpServletRequestBuilder req, JwtRequestPostProcessor quem, Object corpo)
            throws Exception {
        return mvc.perform(req.with(quem).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)));
    }

    private JsonNode corpo(ResultActions r) throws Exception {
        return json.readTree(r.andReturn().getResponse().getContentAsString());
    }

    private int estoque(long produto) throws Exception {
        return corpo(mvc.perform(get("/api/estoque/produtos/{id}", produto).with(VENDEDOR))).get("saldo").asInt();
    }

    private static Map<String, Object> mapa(Object... pares) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pares.length; i += 2) {
            m.put((String) pares[i], pares[i + 1]);
        }
        return m;
    }
}
