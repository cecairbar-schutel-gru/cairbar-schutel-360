package com.durvalcrm.doador;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.StatusCompetencia;
import com.durvalcrm.doador.application.CepPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
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

/** Histórias US-DONOR-001 a 012 de ponta a ponta: HTTP + segurança + PostgreSQL real (Flyway, pg_trgm). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@Transactional
class DoadorApiIntegracaoTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:18-alpine");

    /** Relógio ajustável: "hoje" é 15/10/2026, como no exemplo da US-DONOR-004. */
    static final class RelogioDeTeste extends Clock {
        private Instant agora = Instant.parse("2026-10-15T15:00:00Z");
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
    @Autowired CompetenciaRepository competencias;
    @Autowired EventoAuditoriaRepository auditoria;

    @BeforeEach
    void reiniciarRelogio() {
        relogio.ajustar("2026-10-15T15:00:00Z");
    }

    private static JwtRequestPostProcessor usuario(String nome, String... roles) {
        return jwt().jwt(j -> j.subject("sub-" + nome).claim("preferred_username", nome).claim("name", nome))
                .authorities(java.util.Arrays.stream(roles).map(r -> (org.springframework.security.core.GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList());
    }

    private static final JwtRequestPostProcessor OPERADOR = usuario("Ana", "OPERADOR");
    private static final JwtRequestPostProcessor ADMIN = usuario("Daniel", "ADMINISTRADOR");

    private ResultActions enviar(MockHttpServletRequestBuilder req, JwtRequestPostProcessor quem, Object corpo)
            throws Exception {
        return mvc.perform(req.with(quem).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(corpo)));
    }

    private long cadastrar(String nome, String telefone, String email) throws Exception {
        String resposta = enviar(post("/api/doadores"), OPERADOR, java.util.Map.of("nome", nome, "telefone", telefone,
                "email", email, "consentimentoWhatsapp", "SIM", "consentimentoEmail", "NAO_INFORMADO",
                "duplicatasDescartadas", List.of()))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(resposta).get("id").asLong();
    }

    private List<String> acoes(long doadorId) {
        return auditoria.listarPorEntidade("DOADOR", String.valueOf(doadorId)).stream().map(EventoAuditoria::acao).toList();
    }

    @Test
    void cadastroRapidoCriaAtivoGeraCompetenciaDoMesEAuditaDuplicataDescartada() throws Exception {
        long existente = cadastrar("João da Silva", "(11) 98765-4321", "joao@exemplo.org");

        enviar(post("/api/doadores/duplicatas"), OPERADOR,
                java.util.Map.of("nome", "Joao Silva", "telefone", "11 98765-4321", "email", "JOAO@exemplo.org"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].doador.id").value(existente))
                .andExpect(jsonPath("$[0].motivos", contains("TELEFONE", "EMAIL", "NOME_SIMILAR")));

        String resposta = enviar(post("/api/doadores"), OPERADOR, java.util.Map.of("nome", "Joao Silva",
                "telefone", "11912345678", "email", "", "consentimentoWhatsapp", "NAO_INFORMADO",
                "consentimentoEmail", "NAO", "duplicatasDescartadas", List.of(existente)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ATIVO"))
                .andExpect(jsonPath("$.consentimentoEmail.registradoPor").value("Ana"))
                .andReturn().getResponse().getContentAsString();
        long novo = json.readTree(resposta).get("id").asLong();

        mvc.perform(get("/api/doadores/{id}/competencias", novo).with(OPERADOR))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].competencia").value("2026-10"))
                .andExpect(jsonPath("$[0].status").value("PENDENTE"))
                .andExpect(jsonPath("$[0].valor").value(50.0));
        assertThat(acoes(novo)).containsExactly("DOADOR_CADASTRADO", "DUPLICATA_DESCARTADA");
    }

    @Test
    void cadastroRapidoInvalidoRespondeErrosPorCampo() throws Exception {
        enviar(post("/api/doadores"), OPERADOR, java.util.Map.of("nome", "Maria", "telefone", "123", "email", ""))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.erros[*].campo", contains("nome", "telefone")));
    }

    @Test
    void buscaPorNomeSemAcentoPorFinalDoTelefoneEOrdemAtivosPrimeiro() throws Exception {
        long joao = cadastrar("João da Silva", "11987654321", "");
        long joana = cadastrar("Joana Silveira", "21998887777", "joana@exemplo.org");
        enviar(post("/api/doadores/{id}/inativacao", joao), ADMIN,
                java.util.Map.of("motivo", "Mudou de cidade", "pendencias", "MANTER")).andExpect(status().isOk());

        mvc.perform(get("/api/doadores/busca").param("q", "joao sil").with(OPERADOR))
                .andExpect(jsonPath("$[*].id", contains((int) joao)))
                .andExpect(jsonPath("$[0].status").value("INATIVO"))
                .andExpect(jsonPath("$[0].competenciasPendentes").value(1));
        mvc.perform(get("/api/doadores/busca").param("q", "98765-4321").with(OPERADOR))
                .andExpect(jsonPath("$[*].id", contains((int) joao)));
        mvc.perform(get("/api/doadores/busca").param("q", "sil").with(OPERADOR))
                .andExpect(jsonPath("$[*].id", contains((int) joana, (int) joao)));
        mvc.perform(get("/api/doadores/busca").param("q", "JOANA@").with(OPERADOR))
                .andExpect(jsonPath("$[*].id", contains((int) joana)))
                .andExpect(jsonPath("$[0].emailPrincipal").value("joana@exemplo.org"));
        mvc.perform(get("/api/doadores/busca").param("q", "jo").with(OPERADOR)).andExpect(jsonPath("$", empty()));
    }

    @Test
    void atualizarPerfilValidaCpfUnicoEAuditaSoOsCamposAlterados() throws Exception {
        long outro = cadastrar("Pedro Alves", "11911112222", "");
        long id = cadastrar("Maria Souza", "11987654321", "");
        var perfil = new java.util.HashMap<String, Object>(java.util.Map.of("nome", "Maria Souza", "cpf", "529.982.247-25",
                "dataNascimento", "1980-02-29",
                "telefones", List.of(java.util.Map.of("tipo", "CELULAR", "numero", "(11) 98765-4321", "principal", true)),
                "emails", List.of(java.util.Map.of("endereco", "maria@exemplo.org", "principal", false)),
                "consentimentoWhatsapp", "SIM", "consentimentoEmail", "SIM"));
        perfil.put("endereco", java.util.Map.of("cep", "01310-100", "logradouro", "Avenida Paulista", "numero", "1000",
                "complemento", "", "bairro", "Bela Vista", "cidade", "São Paulo", "uf", "sp"));

        enviar(put("/api/doadores/{id}", id), OPERADOR, perfil)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cpf").value("52998224725"))
                .andExpect(jsonPath("$.emails[0].principal").value(true))
                .andExpect(jsonPath("$.endereco.cep").value("01310100"))
                .andExpect(jsonPath("$.endereco.uf").value("SP"))
                .andExpect(jsonPath("$.consentimentoEmail.valor").value("SIM"));

        enviar(put("/api/doadores/{id}", outro), OPERADOR, java.util.Map.of("nome", "Pedro Alves", "cpf", "52998224725",
                "dataNascimento", "", "telefones", List.of(), "emails", List.of()))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("cpf"))
                .andExpect(jsonPath("$.erros[0].mensagem").value("Já existe um doador com este CPF."));

        EventoAuditoria atualizacao = auditoria.listarPorEntidade("DOADOR", String.valueOf(id)).getLast();
        assertThat(atualizacao.acao()).isEqualTo("DOADOR_ATUALIZADO");
        assertThat(atualizacao.autorSubject()).isEqualTo("sub-Ana");
        assertThat(atualizacao.detalhes()).containsKeys("cpf", "dataNascimento", "emails", "endereco")
                .doesNotContainKey("nome");
    }

    /** Exemplo da US-DONOR-004 (Maria, 08/2026 e 09/2026 pendentes, inativada em 15/10/2026). */
    @Test
    void inativarCancelandoPendentesMantemPagasEReativarGeraSoOMesDaReativacao() throws Exception {
        long maria = cadastrar("Maria Souza", "11987654321", "");
        competencias.salvarTodas(List.of(
                Competencia.reconstituir(null, maria, YearMonth.of(2026, 7), new BigDecimal("50.00"),
                        StatusCompetencia.PAGA, LocalDate.of(2026, 7, 10), "R-0001", null, false),
                Competencia.gerar(maria, YearMonth.of(2026, 8), new BigDecimal("50.00")),
                Competencia.gerar(maria, YearMonth.of(2026, 9), new BigDecimal("50.00"))));

        mvc.perform(post("/api/doadores/{id}/inativacao", maria).with(OPERADOR)
                .contentType(MediaType.APPLICATION_JSON).content("{\"motivo\":\"x\",\"pendencias\":\"CANCELAR\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("ACESSO_NEGADO"));
        enviar(post("/api/doadores/{id}/inativacao", maria), ADMIN,
                java.util.Map.of("motivo", "Parou de contribuir", "pendencias", "CANCELAR"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INATIVO"));

        assertThat(competencias.listarPorDoador(maria)).extracting(c -> c.getMes() + " " + c.getStatus())
                .containsExactly("2026-07 PAGA", "2026-08 CANCELADA", "2026-09 CANCELADA", "2026-10 CANCELADA");
        assertThat(competencias.listarPorDoador(maria)).extracting(Competencia::getValor)
                .allMatch(v -> v.compareTo(new BigDecimal("50")) == 0);
        EventoAuditoria inativacao = auditoria.listarPorEntidade("DOADOR", String.valueOf(maria)).getLast();
        assertThat(inativacao.detalhes()).containsEntry("pendencias", "CANCELAR").containsEntry("competenciasAfetadas", 3);

        relogio.ajustar("2027-01-05T15:00:00Z");
        enviar(post("/api/doadores/{id}/reativacao", maria), ADMIN, java.util.Map.of("motivo", "Voltou"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ATIVO"));
        assertThat(competencias.listarPorDoador(maria)).extracting(c -> c.getMes() + " " + c.getStatus())
                .containsExactly("2026-07 PAGA", "2026-08 CANCELADA", "2026-09 CANCELADA", "2026-10 CANCELADA",
                        "2027-01 PENDENTE");
        enviar(post("/api/doadores/{id}/reativacao", maria), ADMIN, java.util.Map.of("motivo", "de novo"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("STATUS_INVALIDO"));
    }

    @Test
    void anonimizarApagaDadosENotasPreservaCompetenciasESomeDasBuscas() throws Exception {
        long id = cadastrar("Carlos Pereira", "11987650000", "carlos@exemplo.org");
        enviar(post("/api/doadores/{id}/notas", id), OPERADOR, java.util.Map.of("texto", "Prefere pagar aos domingos"))
                .andExpect(status().isCreated());

        enviar(post("/api/doadores/{id}/anonimizacao", id), ADMIN,
                java.util.Map.of("motivo", "Solicitação do titular", "nomeConfirmacao", "carlos pereira"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erros[0].campo").value("pendencias"));
        enviar(post("/api/doadores/{id}/anonimizacao", id), ADMIN, java.util.Map.of("motivo", "Solicitação do titular",
                "nomeConfirmacao", "carlos pereira", "pendencias", "MANTER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Doador anonimizado #" + id))
                .andExpect(jsonPath("$.status").value("ANONIMIZADO"))
                .andExpect(jsonPath("$.telefones", empty()))
                .andExpect(jsonPath("$.consentimentoWhatsapp.valor").value("NAO_INFORMADO"));

        mvc.perform(get("/api/doadores/{id}/notas", id).with(OPERADOR)).andExpect(jsonPath("$", empty()));
        mvc.perform(get("/api/doadores/busca").param("q", "carlos").with(OPERADOR)).andExpect(jsonPath("$", empty()));
        mvc.perform(get("/api/doadores/busca").param("q", "87650000").with(OPERADOR)).andExpect(jsonPath("$", empty()));
        assertThat(competencias.listarPorDoador(id)).hasSize(1);
        enviar(post("/api/doadores/{id}/reativacao", id), ADMIN, java.util.Map.of("motivo", "x"))
                .andExpect(status().isConflict());
        enviar(post("/api/doadores/{id}/notas", id), OPERADOR, java.util.Map.of("texto", "x"))
                .andExpect(status().isConflict());

        EventoAuditoria evento = auditoria.listarPorEntidade("DOADOR", String.valueOf(id)).getLast();
        assertThat(evento.acao()).isEqualTo("DOADOR_ANONIMIZADO");
        assertThat(evento.detalhes()).containsEntry("motivo", "Solicitação do titular");
        assertThat(json.writeValueAsString(evento.detalhes())).doesNotContain("Carlos", "carlos", "1198765");
    }

    @Test
    void notasMaisRecentesPrimeiroComAutorELimiteDe500() throws Exception {
        long id = cadastrar("Lucia Gomes", "11987651111", "");
        enviar(post("/api/doadores/{id}/notas", id), OPERADOR, java.util.Map.of("texto", "primeira"));
        relogio.ajustar("2026-10-16T15:00:00Z");
        enviar(post("/api/doadores/{id}/notas", id), ADMIN, java.util.Map.of("texto", "segunda"));
        enviar(post("/api/doadores/{id}/notas", id), OPERADOR, java.util.Map.of("texto", "x".repeat(501)))
                .andExpect(status().isUnprocessableContent());

        mvc.perform(get("/api/doadores/{id}/notas", id).with(OPERADOR))
                .andExpect(jsonPath("$[*].texto", contains("segunda", "primeira")))
                .andExpect(jsonPath("$[0].autor").value("Daniel"));
    }

    @Test
    void aniversariantesDoMesOrdenadosPorDiaComContadorSemData() throws Exception {
        long bia = cadastrar("Beatriz Lima", "11987652222", "");
        long caio = cadastrar("Caio Rocha", "11987653333", "");
        cadastrar("Sem Data", "11987654444", "");
        definirNascimento(bia, "1990-10-20");
        definirNascimento(caio, "2000-10-03");

        String corpo = mvc.perform(get("/api/doadores/aniversariantes").param("de", "2026-10-01")
                        .param("ate", "2026-10-31").with(OPERADOR))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode r = json.readTree(corpo);
        assertThat(r.get("semDataNascimento").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(r.get("itens").findValuesAsString("nome")).containsSubsequence("Caio Rocha", "Beatriz Lima");
        JsonNode caioItem = r.get("itens").get(r.get("itens").findValuesAsString("nome").indexOf("Caio Rocha"));
        assertThat(caioItem.get("dataAniversario").asString()).isEqualTo("2026-10-03");
        assertThat(caioItem.get("idadeACompletar").asInt()).isEqualTo(26);
        assertThat(caioItem.get("consentimentoWhatsapp").asString()).isEqualTo("SIM");

        mvc.perform(get("/api/doadores/aniversariantes").param("de", "2026-10-01").param("ate", "2026-10-31")
                .with(ADMIN)).andExpect(status().isOk());
        mvc.perform(get("/api/doadores/aniversariantes").param("de", "2026-10-01").param("ate", "2026-10-31")
                .with(usuario("Bruno", "VENDEDOR"))).andExpect(status().isForbidden());
    }

    @Test
    void aniversarioEm29DeFevereiroEhComemoradoEm28EmAnoNaoBissexto() throws Exception {
        long id = cadastrar("Fabio Bissexto", "11987655555", "");
        definirNascimento(id, "1992-02-29");
        mvc.perform(get("/api/doadores/aniversariantes").param("de", "2027-02-28").param("ate", "2027-02-28")
                        .with(OPERADOR))
                .andExpect(jsonPath("$.itens[?(@.doadorId == " + id + ")].dataAniversario", contains("2027-02-28")));
    }

    @Test
    void cepConsultadoOuSemConteudoESegurancaDosEndpoints() throws Exception {
        org.mockito.Mockito.when(cep.consultar("01310100")).thenReturn(Optional.of(
                new com.durvalcrm.doador.domain.Endereco("01310100", "Avenida Paulista", "", "", "Bela Vista",
                        "São Paulo", "SP")));
        mvc.perform(get("/api/enderecos/cep/01310-100").with(OPERADOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cidade").value("São Paulo"));
        mvc.perform(get("/api/enderecos/cep/99999999").with(OPERADOR)).andExpect(status().isNoContent());

        mvc.perform(get("/api/doadores/busca").param("q", "maria"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTENTICADO"));
        mvc.perform(get("/api/doadores/busca").param("q", "maria").with(usuario("Bruno", "VENDEDOR")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/doadores/999999").with(OPERADOR))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("DOADOR_NAO_ENCONTRADO"));
    }

    private void definirNascimento(long id, String data) throws Exception {
        JsonNode atual = json.readTree(mvc.perform(get("/api/doadores/{id}", id).with(OPERADOR))
                .andReturn().getResponse().getContentAsString());
        var corpo = new java.util.HashMap<String, Object>();
        corpo.put("nome", atual.get("nome").asString());
        corpo.put("cpf", "");
        corpo.put("dataNascimento", data);
        corpo.put("telefones", json.treeToValue(atual.get("telefones"), List.class));
        corpo.put("emails", json.treeToValue(atual.get("emails"), List.class));
        corpo.put("consentimentoWhatsapp", atual.get("consentimentoWhatsapp").get("valor").asString());
        corpo.put("consentimentoEmail", atual.get("consentimentoEmail").get("valor").asString());
        enviar(put("/api/doadores/{id}", id), OPERADOR, corpo).andExpect(status().isOk());
    }
}
