package com.durvalcrm.administracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.contribuicao.application.GerarCompetenciasMensaisUseCase;
import com.durvalcrm.doador.application.CepPort;
import com.durvalcrm.financeiro.application.ConsultaFinanceiraPort;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
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
import org.springframework.dao.DataAccessException;
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

/** Administração (US-ADMIN-001 a 005, 009, 012 e 021) de ponta a ponta: HTTP + segurança + PostgreSQL real. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class AdministracaoApiIntegracaoTest {

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
    @Autowired GerarCompetenciasMensaisUseCase geracao;
    @Autowired ConsultaFinanceiraPort consulta;

    long caixa;

    private static List<GrantedAuthority> papeis(String... roles) {
        return Arrays.stream(roles).map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
    }

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(papeis(roles));
    }

    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR", "TESOUREIRO");
    private static final JwtRequestPostProcessor TESOUREIRO = usuario("Carla", "TESOUREIRO");
    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");
    private static final JwtRequestPostProcessor VENDEDOR = usuario("Bruno", "VENDEDOR");

    @BeforeEach
    void preparar() throws Exception {
        relogio.ajustar("2026-10-19T13:00:00Z");
        caixa = corpo(enviar(post("/api/financeiro/contas"), ADMIN, mapa("tipo", "CAIXA", "nome", "Caixa Secretaria",
                "saldoInicial", 200, "dataCorte", "2026-09-01"))
                .andExpect(status().isCreated())).get("id").asLong();
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    // US-ADMIN-002

    @Test
    void novoValorDaMensalidadeValeSoParaCompetenciasGeradasDepois() throws Exception {
        long doador = cadastrarDoador("Carlos Almeida", "11987654321");
        enviar(post("/api/administracao/mensalidade/agendamento").header("X-Perfil-Ativo", "administrador"), ADMIN,
                mapa("valor", "60.00", "vigenteDe", "2027-01", "motivo", "Reajuste aprovado em assembleia"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vigente.valor").value(50.00))
                .andExpect(jsonPath("$.agendada.valor").value(60.00))
                .andExpect(jsonPath("$.agendada.vigenteDe").value("2027-01"));
        enviar(post("/api/administracao/mensalidade/agendamento"), ADMIN,
                mapa("valor", "70.00", "vigenteDe", "2027-02", "motivo", "Outro reajuste"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("AGENDAMENTO_EXISTENTE"));
        enviar(post("/api/administracao/mensalidade/agendamento"), VENDEDOR,
                mapa("valor", "70.00", "vigenteDe", "2027-02", "motivo", "x")).andExpect(status().isForbidden());

        relogio.ajustar("2026-11-01T03:05:00Z");
        geracao.gerar(YearMonth.of(2026, 11));
        relogio.ajustar("2027-01-01T03:05:00Z");
        geracao.gerar(YearMonth.of(2027, 1));
        Map<String, BigDecimal> valores = new LinkedHashMap<>();
        jdbc.sql("select to_char(mes, 'YYYY-MM') as m, valor from competencia where doador_id = ? order by mes")
                .param(doador).query(rs -> {
                    valores.put(rs.getString("m"), rs.getBigDecimal("valor"));
                });
        assertThat(valores).containsOnlyKeys("2026-10", "2026-11", "2027-01");
        assertThat(valores.get("2026-10")).isEqualByComparingTo("50.00");
        assertThat(valores.get("2026-11")).isEqualByComparingTo("50.00");
        assertThat(valores.get("2027-01")).isEqualByComparingTo("60.00");

        // Em janeiro o agendamento virou o valor vigente e não pode mais ser cancelado.
        mvc.perform(delete("/api/administracao/mensalidade/agendamento").with(ADMIN))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("SEM_AGENDAMENTO"));

        // A auditoria guarda o perfil em uso e o IP.
        mvc.perform(get("/api/auditoria").param("acao", "MENSALIDADE_AGENDADA").with(ADMIN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].perfil").value("administrador"))
                .andExpect(jsonPath("$.itens[0].ip").value("127.0.0.1"))
                .andExpect(jsonPath("$.itens[0].detalhes.depois.valor").value(60.00))
                .andExpect(jsonPath("$.itens[0].detalhes.motivo").value("Reajuste aprovado em assembleia"));
    }

    @Test
    void agendamentoPodeSerAlteradoECanceladoAteOMesDele() throws Exception {
        enviar(post("/api/administracao/mensalidade/agendamento"), ADMIN,
                mapa("valor", "60.00", "vigenteDe", "2027-01", "motivo", "Reajuste anual")).andExpect(status().isOk());
        enviar(put("/api/administracao/mensalidade/agendamento"), ADMIN,
                mapa("valor", "55.00", "vigenteDe", "2026-12", "motivo", "Reajuste menor")).andExpect(status().isOk())
                .andExpect(jsonPath("$.agendada.valor").value(55.00));
        enviar(put("/api/administracao/mensalidade/agendamento"), ADMIN,
                mapa("valor", "55.00", "vigenteDe", "2026-10", "motivo", "Para este mês"))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(delete("/api/administracao/mensalidade/agendamento").with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.agendada").doesNotExist());
    }

    // US-ADMIN-003

    @Test
    void modelosDeMensagemComVariaveisConhecidas() throws Exception {
        mvc.perform(get("/api/administracao/modelos-mensagem").with(OPERADOR)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tipo").value("AGRADECIMENTO"))
                .andExpect(jsonPath("$[1].variaveis.length()").value(3));
        enviar(put("/api/administracao/modelos-mensagem/ANIVERSARIO"), ADMIN,
                mapa("whatsapp", "Parabéns, {doador}!", "emailAssunto", "Feliz aniversário", "emailCorpo", "Olá"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("whatsapp"));
        enviar(put("/api/administracao/modelos-mensagem/ANIVERSARIO"), OPERADOR,
                mapa("whatsapp", "Parabéns, {nome}!", "emailAssunto", "Oi", "emailCorpo", "Olá"))
                .andExpect(status().isForbidden());
        enviar(put("/api/administracao/modelos-mensagem/ANIVERSARIO"), ADMIN,
                mapa("whatsapp", "Parabéns, {nome}! {organizacao}", "emailAssunto", "Feliz aniversário, {nome}",
                        "emailCorpo", "Olá, {nome}!"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.atualizadoPor").value("Daniel"));
        mvc.perform(get("/api/auditoria/entidades/ModeloMensagem/ANIVERSARIO").with(ADMIN))
                .andExpect(jsonPath("$[0].acao").value("MODELO_MENSAGEM_ALTERADO"))
                .andExpect(jsonPath("$[0].detalhes.depois.whatsapp").value("Parabéns, {nome}! {organizacao}"));
    }

    // US-ADMIN-004

    @Test
    void planoDeContasCriaRenomeiaInativaEExclui() throws Exception {
        JsonNode nova = corpo(enviar(post("/api/administracao/plano-contas"), ADMIN,
                mapa("nome", "Material gráfico", "categoriaPai", "OUTRAS_DESPESAS")).andExpect(status().isCreated()));
        assertThat(nova.get("codigo").asString()).isEqualTo("OUTRAS_DESPESAS.MATERIAL_GRAFICO");
        assertThat(nova.get("tipo").asString()).isEqualTo("DESPESA");
        enviar(post("/api/administracao/plano-contas"), ADMIN,
                mapa("nome", "material GRÁFICO", "categoriaPai", "OUTRAS_DESPESAS"))
                .andExpect(status().isUnprocessableContent());
        enviar(put("/api/administracao/plano-contas/DESPESAS_COMERCIAIS.TAXAS_CARTAO"), ADMIN,
                mapa("nome", "Tarifas de cartão")).andExpect(status().isOk());
        mvc.perform(post("/api/administracao/plano-contas/DESPESAS_COMERCIAIS.TAXAS_CARTAO/inativacao").with(ADMIN))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CATEGORIA_SISTEMA"));
        mvc.perform(post("/api/administracao/plano-contas/OUTRAS_DESPESAS.EVENTOS/inativacao").with(ADMIN))
                .andExpect(status().isOk());
        mvc.perform(get("/api/financeiro/categorias").with(TESOUREIRO))
                .andExpect(jsonPath("$[?(@.codigo == 'OUTRAS_DESPESAS.EVENTOS')].ativa").value(false))
                .andExpect(jsonPath("$[?(@.codigo == 'DESPESAS_COMERCIAIS.TAXAS_CARTAO')].nome")
                        .value("Tarifas de cartão"));
        mvc.perform(delete("/api/administracao/plano-contas/OUTRAS_DESPESAS.MATERIAL_GRAFICO").with(ADMIN))
                .andExpect(status().isNoContent());

        // Usada num lançamento, só pode ser inativada.
        enviar(post("/api/financeiro/lancamentos"), TESOUREIRO, mapa("tipo", "DESPESA", "contaId", caixa,
                "categoria", "OUTRAS_DESPESAS.TAXAS_BANCARIAS", "valor", "5.00", "data", "2026-10-19",
                "descricao", "Tarifa", "chaveIdempotencia", "k-1")).andExpect(status().isCreated());
        mvc.perform(delete("/api/administracao/plano-contas/OUTRAS_DESPESAS.TAXAS_BANCARIAS").with(ADMIN))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("CATEGORIA_EM_USO"));
        mvc.perform(get("/api/administracao/plano-contas").with(TESOUREIRO)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].categoria.tipo").value("RECEITA"));
    }

    // US-ADMIN-005

    @Test
    void dadosDaOrganizacaoComLogotipo() throws Exception {
        mvc.perform(get("/api/administracao/organizacao").with(VENDEDOR)).andExpect(status().isOk())
                .andExpect(jsonPath("$.padrao").value(true))
                .andExpect(jsonPath("$.fusoHorario").value("America/Sao_Paulo"));
        enviar(put("/api/administracao/organizacao"), ADMIN, mapa("razaoSocial", "Centro Espírita Cairbar Schutel",
                "nomeExibicao", "CE Cairbar Schutel", "cnpj", "11.222.333/0001-82")).andExpect(
                        status().isUnprocessableContent()).andExpect(jsonPath("$.erros[0].campo").value("cnpj"));
        byte[] png = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
        enviar(put("/api/administracao/organizacao"), ADMIN, mapa("razaoSocial", "Centro Espírita Cairbar Schutel",
                "nomeExibicao", "CE Cairbar Schutel", "cnpj", "11.222.333/0001-81", "email", "contato@cairbar.org",
                "logo", mapa("conteudo", Base64.getEncoder().encodeToString(png), "tipo", "image/png"),
                "rodapeRecibo", "Gratidão!", "tipoChavePix", "TELEFONE", "chavePix", "(11) 98888-7777",
                "cidadePix", "São Paulo"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.padrao").value(false))
                .andExpect(jsonPath("$.chavePix").value("+5511988887777"))
                .andExpect(jsonPath("$.temLogo").value(true)).andExpect(jsonPath("$.cnpj").value("11222333000181"));
        // O PDV da cantina lê a chave PIX para gerar o QR Code.
        mvc.perform(get("/api/administracao/organizacao").with(VENDEDOR))
                .andExpect(jsonPath("$.tipoChavePix").value("TELEFONE"))
                .andExpect(jsonPath("$.cidadePix").value("São Paulo"));
        mvc.perform(get("/api/administracao/organizacao/logo").with(OPERADOR)).andExpect(status().isOk())
                .andExpect(content().contentType("image/png")).andExpect(content().bytes(png));
        mvc.perform(get("/api/auditoria").param("entidade", "Organizacao").with(ADMIN))
                .andExpect(jsonPath("$.itens[0].detalhes.depois.logo").value("alterado"))
                .andExpect(jsonPath("$.itens[0].detalhes.antes.razaoSocial").value("Centro Espírita Cairbar Schutel"));
    }

    // US-ADMIN-009

    @Test
    void auditoriaSoDeInsercaoComFiltrosEHistoricoDaEntidade() throws Exception {
        long doador = cadastrarDoador("Luciana Pereira", "11912345678");
        enviar(post("/api/auditoria/sessao"), OPERADOR, mapa("evento", "LOGIN")).andExpect(status().isNoContent());
        mvc.perform(get("/api/auditoria").param("usuario", "ana").param("de", "2026-10-19").param("ate", "2026-10-19")
                .with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.itens[0].acao").value("LOGIN"))
                .andExpect(jsonPath("$.itens[1].acao").value("DOADOR_CADASTRADO"));
        mvc.perform(get("/api/auditoria").with(TESOUREIRO)).andExpect(status().isForbidden());
        mvc.perform(get("/api/auditoria/entidades/DOADOR/" + doador).with(OPERADOR)).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].acao").value("DOADOR_CADASTRADO"));
        mvc.perform(get("/api/auditoria/opcoes").with(ADMIN)).andExpect(jsonPath("$.acoes").isArray());

        assertThatThrownBy(() -> jdbc.sql("update evento_auditoria set acao = 'X'").update())
                .isInstanceOf(DataAccessException.class).hasMessageContaining("só de inserção");
        assertThatThrownBy(() -> jdbc.sql("delete from evento_auditoria").update())
                .isInstanceOf(DataAccessException.class);
    }

    // US-ADMIN-012

    @Test
    void historicoFinanceiroImportadoAntesDoCorteFechaOsMesesSemMudarOSaldo() throws Exception {
        String csv = """
                Data;Conta;Tipo;Subcategoria;Descrição;Valor
                15/07/2026;Caixa Secretaria;Receita;Receitas de contribuições › Mensalidades;Mensalidades de julho;1.250,00
                20/08/2026;caixa-secretaria;Despesa;Energia elétrica;Luz de agosto;312,45
                """;
        JsonNode previa = corpo(enviar(post("/api/administracao/importacoes/previa"), ADMIN,
                importacao("FINANCEIRO", csv)).andExpect(status().isOk()));
        assertThat(previa.get("erros")).isEmpty();
        assertThat(previa.get("totaisPorConta").get(0).get("receitas").decimalValue()).isEqualByComparingTo("1250.00");
        assertThat(previa.get("totaisPorConta").get(0).get("despesas").decimalValue()).isEqualByComparingTo("312.45");
        assertThat(previa.get("mesesAFechar").toString()).isEqualTo("[\"2026-07\",\"2026-08\"]");

        long id = corpo(enviar(post("/api/administracao/importacoes"), ADMIN, importacao("FINANCEIRO", csv))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.linhasImportadas").value(2))).get("id").asLong();
        assertThat(consulta.saldos(null).get(caixa)).isEqualByComparingTo("200.00");
        // Antes do corte, o saldo volta pelo histórico: 200,00 + 312,45 de agosto − 1.250,00 de julho.
        assertThat(consulta.saldos(LocalDate.of(2026, 7, 31)).get(caixa)).isEqualByComparingTo("512.45");
        assertThat(consulta.saldos(LocalDate.of(2026, 6, 30)).get(caixa)).isEqualByComparingTo("-737.55");
        assertThat(consulta.saldos(LocalDate.of(2026, 8, 31)).get(caixa)).isEqualByComparingTo("200.00");
        assertThat(jdbc.sql("select count(*) from periodo where status = 'FECHADO'").query(Long.class).single())
                .isEqualTo(2);
        mvc.perform(get("/api/financeiro/lancamentos").param("contaId", String.valueOf(caixa))
                .param("de", "2026-07-01").with(TESOUREIRO)).andExpect(status().isOk())
                .andExpect(jsonPath("$.itens.length()").value(2))
                .andExpect(jsonPath("$.saldoFinal").value(200.00));
        // O mesmo período não pode ser importado de novo: os meses estão fechados.
        mvc.perform(post("/api/administracao/importacoes/previa").with(ADMIN).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(importacao("FINANCEIRO", csv))))
                .andExpect(jsonPath("$.erros[0].mensagem").value("O mês 07/2026 já está fechado."));

        mvc.perform(get("/api/administracao/importacoes").with(ADMIN)).andExpect(jsonPath("$[0].podeDesfazer").value(true));
        mvc.perform(post("/api/administracao/importacoes/" + id + "/desfazer").with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.situacao").value("DESFEITA"));
        assertThat(jdbc.sql("select count(*) from lancamento_financeiro where origem_tipo = 'IMPORTACAO'")
                .query(Long.class).single()).isZero();
        assertThat(jdbc.sql("select count(*) from periodo").query(Long.class).single()).isZero();
    }

    @Test
    void importacaoComErroNaoImportaNada() throws Exception {
        String csv = """
                Data;Conta;Tipo;Subcategoria;Descrição;Valor
                15/07/2026;Caixa Secretaria;Receita;Mensalidades;Julho;100,00
                15/09/2026;Caixa Secretaria;Receita;Mensalidades;Depois do corte;100,00
                16/07/2026;Caixa Inexistente;Despesa;Água;Água;abc
                """;
        mvc.perform(post("/api/administracao/importacoes/previa").with(ADMIN).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(importacao("FINANCEIRO", csv))))
                .andExpect(jsonPath("$.erros.length()").value(3))
                .andExpect(jsonPath("$.erros[0].linha").value(3))
                .andExpect(jsonPath("$.erros[0].coluna").value("Data"))
                .andExpect(jsonPath("$.erros[1].linha").value(4))
                .andExpect(jsonPath("$.erros[1].coluna").value("Conta"));
        enviar(post("/api/administracao/importacoes"), ADMIN, importacao("FINANCEIRO", csv))
                .andExpect(status().isUnprocessableContent());
        assertThat(jdbc.sql("select count(*) from lancamento_financeiro").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("select count(*) from importacao").query(Long.class).single()).isZero();
    }

    @Test
    void doadoresImportadosComDuplicataDecididaECompetenciasPendentes() throws Exception {
        cadastrarDoador("Maria da Silva", "11987654321");
        String csv = """
                Nome;Telefone;E-mail;Data de nascimento;CPF;Consentimento WhatsApp;Consentimento e-mail;Competências pendentes
                Maria da Silva;(11) 98765-4321;;12/10/1970;;Sim;;
                João Pereira;(11) 3333-4444;joao@exemplo.com;05/03/1980;529.982.247-25;Não;Sim;08/2026, 09/2026
                """;
        JsonNode previa = corpo(enviar(post("/api/administracao/importacoes/previa"), ADMIN,
                importacao("DOADORES", csv)).andExpect(status().isOk()));
        assertThat(previa.get("erros")).isEmpty();
        assertThat(previa.get("duplicatas").get(0).get("linha").asInt()).isEqualTo(2);
        assertThat(previa.get("competencias").asInt()).isEqualTo(2);
        enviar(post("/api/administracao/importacoes"), ADMIN, importacao("DOADORES", csv))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("DUPLICATAS_SEM_DECISAO"));

        Map<String, Object> pedido = importacao("DOADORES", csv);
        pedido.put("decisoes", Map.of("2", "IGNORAR"));
        long id = corpo(enviar(post("/api/administracao/importacoes"), ADMIN, pedido).andExpect(status().isCreated())
                .andExpect(jsonPath("$.linhasImportadas").value(1))).get("id").asLong();
        long joao = jdbc.sql("select id from doador where nome = 'João Pereira'").query(Long.class).single();
        assertThat(jdbc.sql("select to_char(mes, 'YYYY-MM') from competencia where doador_id = ? order by mes")
                .param(joao).query(String.class).list()).containsExactly("2026-08", "2026-09", "2026-10");
        assertThat(jdbc.sql("select cpf from doador where id = ?").param(joao).query(String.class).single())
                .isEqualTo("52998224725");

        mvc.perform(post("/api/administracao/importacoes/" + id + "/desfazer").with(ADMIN)).andExpect(status().isOk());
        assertThat(jdbc.sql("select count(*) from doador where nome = 'João Pereira'").query(Long.class).single())
                .isZero();
    }

    @Test
    void doadorImportadoComNotaNaoPodeSerDesfeito() throws Exception {
        String csv = "Nome;Telefone;E-mail;Data de nascimento;CPF;Consentimento WhatsApp;Consentimento e-mail;"
                + "Competências pendentes\nRoberto Santos;11955554444;;;;;;\n";
        long id = corpo(enviar(post("/api/administracao/importacoes"), ADMIN, importacao("DOADORES", csv))
                .andExpect(status().isCreated())).get("id").asLong();
        long roberto = jdbc.sql("select id from doador where nome = 'Roberto Santos'").query(Long.class).single();
        enviar(post("/api/doadores/" + roberto + "/notas"), OPERADOR, mapa("texto", "Prefere contato à tarde"))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(post("/api/administracao/importacoes/" + id + "/desfazer").with(ADMIN))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.codigo").value("IMPORTACAO_COM_MOVIMENTOS"));
    }

    // US-ADMIN-001 e 021

    @Test
    void painelDoAdministradorEUsuariosSemIntegracao() throws Exception {
        cadastrarDoador("Pedro Santos", "11966554433");
        enviar(post("/api/administracao/mensalidade/agendamento"), ADMIN,
                mapa("valor", "60.00", "vigenteDe", "2027-01", "motivo", "Reajuste anual")).andExpect(status().isOk());
        mvc.perform(get("/api/administracao/painel").with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.doadoresAtivos").value(1))
                .andExpect(jsonPath("$.receitasDespesas.length()").value(6))
                .andExpect(jsonPath("$.receitasDespesas[5].mes").value("2026-10"))
                .andExpect(jsonPath("$.mensalidadeAgendada.valor").value(60.00));
        mvc.perform(get("/api/administracao/painel").with(TESOUREIRO)).andExpect(status().isForbidden());
        mvc.perform(get("/api/administracao/usuarios").with(ADMIN)).andExpect(status().isOk())
                .andExpect(jsonPath("$.configurado").value(false));
    }

    private long cadastrarDoador(String nome, String telefone) throws Exception {
        return corpo(enviar(post("/api/doadores"), OPERADOR, mapa("nome", nome, "telefone", telefone, "email", "",
                "consentimentoWhatsapp", "SIM", "consentimentoEmail", "NAO_INFORMADO", "duplicatasDescartadas",
                List.of())).andExpect(status().isCreated())).get("id").asLong();
    }

    private static Map<String, Object> importacao(String tipo, String csv) {
        return mapa("tipo", tipo, "arquivo", "historico.csv", "conteudo",
                Base64.getEncoder().encodeToString(csv.getBytes(StandardCharsets.UTF_8)));
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
}
