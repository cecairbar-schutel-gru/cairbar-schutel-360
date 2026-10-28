package com.durvalcrm.administracao.adapter.in.rest;

import com.durvalcrm.administracao.application.ImportacaoUseCase;
import com.durvalcrm.administracao.application.ImportacaoUseCase.Previa;
import com.durvalcrm.administracao.application.MensalidadeUseCase;
import com.durvalcrm.administracao.application.MensalidadeUseCase.SituacaoMensalidade;
import com.durvalcrm.administracao.application.ModelosMensagemUseCase;
import com.durvalcrm.administracao.application.OrganizacaoUseCase;
import com.durvalcrm.administracao.application.PainelAdministradorUseCase;
import com.durvalcrm.administracao.application.PainelAdministradorUseCase.PainelAdministrador;
import com.durvalcrm.administracao.application.PlanoDeContasUseCase;
import com.durvalcrm.administracao.application.PlanoDeContasUseCase.CategoriaComSubcategorias;
import com.durvalcrm.administracao.application.UsuariosUseCase;
import com.durvalcrm.administracao.application.UsuariosUseCase.ListaUsuarios;
import com.durvalcrm.administracao.domain.CategoriaPlano;
import com.durvalcrm.administracao.domain.Importacao;
import com.durvalcrm.administracao.domain.ModeloMensagem;
import com.durvalcrm.administracao.domain.ChavePix;
import com.durvalcrm.administracao.domain.Organizacao;
import com.durvalcrm.administracao.domain.TipoImportacao;
import com.durvalcrm.administracao.domain.TipoModelo;
import com.durvalcrm.financeiro.domain.TipoCategoria;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * API da Administração (US-ADMIN-001 a 005, 012 e 021). Só o Administrador altera; os modelos de
 * mensagem são lidos pelo Operador, o plano de contas pela Tesouraria e os dados da organização por
 * todos (cabeçalhos e comprovantes).
 */
@RestController
@RequestMapping("/api/administracao")
class AdministracaoController {

    private static final String ADMIN = "hasRole('ADMINISTRADOR')";

    private final PainelAdministradorUseCase painel;
    private final UsuariosUseCase usuarios;
    private final MensalidadeUseCase mensalidade;
    private final ModelosMensagemUseCase modelos;
    private final PlanoDeContasUseCase plano;
    private final OrganizacaoUseCase organizacao;
    private final ImportacaoUseCase importacoes;

    AdministracaoController(PainelAdministradorUseCase painel, UsuariosUseCase usuarios, MensalidadeUseCase mensalidade,
            ModelosMensagemUseCase modelos, PlanoDeContasUseCase plano, OrganizacaoUseCase organizacao,
            ImportacaoUseCase importacoes) {
        this.painel = painel;
        this.usuarios = usuarios;
        this.mensalidade = mensalidade;
        this.modelos = modelos;
        this.plano = plano;
        this.organizacao = organizacao;
        this.importacoes = importacoes;
    }

    /** US-ADMIN-021 (wireframe 4). */
    @GetMapping("/painel")
    @PreAuthorize(ADMIN)
    PainelAdministrador painel() {
        return painel.consultar();
    }

    /** US-ADMIN-001: só leitura. */
    @GetMapping("/usuarios")
    @PreAuthorize(ADMIN)
    ListaUsuarios usuarios() {
        return usuarios.listar();
    }

    // US-ADMIN-002

    @GetMapping("/mensalidade")
    @PreAuthorize("hasAnyRole('ADMINISTRADOR', 'TESOUREIRO')")
    SituacaoMensalidade mensalidade() {
        return mensalidade.consultar();
    }

    /** 409 AGENDAMENTO_EXISTENTE. */
    @PostMapping("/mensalidade/agendamento")
    @PreAuthorize(ADMIN)
    SituacaoMensalidade agendar(@RequestBody MensalidadeRequest r) {
        return mensalidade.agendar(r.valor(), mes(r.vigenteDe()), r.motivo());
    }

    /** 409 SEM_AGENDAMENTO (o mês dela já começou). */
    @PutMapping("/mensalidade/agendamento")
    @PreAuthorize(ADMIN)
    SituacaoMensalidade alterarAgendamento(@RequestBody MensalidadeRequest r) {
        return mensalidade.alterarAgendada(r.valor(), mes(r.vigenteDe()), r.motivo());
    }

    @DeleteMapping("/mensalidade/agendamento")
    @PreAuthorize(ADMIN)
    SituacaoMensalidade cancelarAgendamento() {
        return mensalidade.cancelarAgendada();
    }

    // US-ADMIN-003

    @GetMapping("/modelos-mensagem")
    @PreAuthorize("hasAnyRole('OPERADOR', 'ADMINISTRADOR')")
    List<ModeloResponse> modelos() {
        return modelos.listar().stream().map(ModeloResponse::de).toList();
    }

    /** 422 com variável desconhecida. */
    @PutMapping("/modelos-mensagem/{tipo}")
    @PreAuthorize(ADMIN)
    ModeloResponse salvarModelo(@PathVariable TipoModelo tipo, @RequestBody ModeloRequest r) {
        return ModeloResponse.de(modelos.salvar(tipo, r.whatsapp(), r.emailAssunto(), r.emailCorpo()));
    }

    // US-ADMIN-004

    @GetMapping("/plano-contas")
    @PreAuthorize("hasAnyRole('TESOUREIRO', 'ADMINISTRADOR')")
    List<CategoriaComSubcategorias> planoDeContas() {
        return plano.listar();
    }

    @PostMapping("/plano-contas")
    @PreAuthorize(ADMIN)
    @ResponseStatus(HttpStatus.CREATED)
    CategoriaPlano criarCategoria(@RequestBody CategoriaRequest r) {
        return plano.criar(r.nome(), r.tipo(), r.categoriaPai());
    }

    @PutMapping("/plano-contas/{codigo}")
    @PreAuthorize(ADMIN)
    CategoriaPlano renomearCategoria(@PathVariable String codigo, @RequestBody CategoriaRequest r) {
        return plano.renomear(codigo, r.nome());
    }

    /** 409 CATEGORIA_SISTEMA. */
    @PostMapping("/plano-contas/{codigo}/inativacao")
    @PreAuthorize(ADMIN)
    List<CategoriaPlano> inativarCategoria(@PathVariable String codigo) {
        return plano.inativar(codigo);
    }

    @PostMapping("/plano-contas/{codigo}/reativacao")
    @PreAuthorize(ADMIN)
    CategoriaPlano reativarCategoria(@PathVariable String codigo) {
        return plano.reativar(codigo);
    }

    /** 409 CATEGORIA_EM_USO, CATEGORIA_SISTEMA ou CATEGORIA_COM_SUBCATEGORIAS. */
    @DeleteMapping("/plano-contas/{codigo}")
    @PreAuthorize(ADMIN)
    ResponseEntity<Void> excluirCategoria(@PathVariable String codigo) {
        plano.excluir(codigo);
        return ResponseEntity.noContent().build();
    }

    // US-ADMIN-005

    @GetMapping("/organizacao")
    @PreAuthorize("isAuthenticated()")
    OrganizacaoResponse organizacao() {
        return OrganizacaoResponse.de(organizacao.consultar());
    }

    @PutMapping("/organizacao")
    @PreAuthorize(ADMIN)
    OrganizacaoResponse salvarOrganizacao(@RequestBody OrganizacaoRequest r) {
        Organizacao.Logo logo = null;
        if (r.logo() != null && r.logo().conteudo() != null) {
            logo = new Organizacao.Logo(base64("logo", r.logo().conteudo()), r.logo().tipo());
        }
        return OrganizacaoResponse.de(organizacao.salvar(r.razaoSocial(), r.nomeExibicao(), r.cnpj(), r.endereco(),
                r.telefone(), r.email(), logo, Boolean.TRUE.equals(r.removerLogo()), r.rodapeRecibo(),
                r.tipoChavePix(), r.chavePix(), r.cidadePix()));
    }

    /** 204 enquanto vale o logotipo da instalação. */
    @GetMapping("/organizacao/logo")
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<byte[]> logo() {
        Organizacao o = organizacao.consultar();
        if (o.logo() == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(o.logo().tipo())).body(o.logo().conteudo());
    }

    // US-ADMIN-012

    @GetMapping("/importacoes")
    @PreAuthorize(ADMIN)
    List<ImportacaoResponse> importacoes() {
        return importacoes.listar().stream().map(i -> ImportacaoResponse.de(i.importacao(), i.podeDesfazer())).toList();
    }

    @GetMapping("/importacoes/modelos/{tipo}")
    @PreAuthorize(ADMIN)
    ResponseEntity<byte[]> modeloImportacao(@PathVariable TipoImportacao tipo) {
        String nome = tipo == TipoImportacao.FINANCEIRO ? "modelo-historico-financeiro.csv" : "modelo-doadores.csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(nome).build().toString())
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(importacoes.modelo(tipo));
    }

    @PostMapping("/importacoes/previa")
    @PreAuthorize(ADMIN)
    Previa previa(@RequestBody ImportacaoRequest r) {
        return importacoes.previa(r.tipo(), r.arquivo(), base64("arquivo", r.conteudo()));
    }

    /** 422 com erro em alguma linha; 409 DUPLICATAS_SEM_DECISAO. */
    @PostMapping("/importacoes")
    @PreAuthorize(ADMIN)
    @ResponseStatus(HttpStatus.CREATED)
    ImportacaoResponse importar(@RequestBody ImportacaoRequest r) {
        Importacao i = importacoes.confirmar(r.tipo(), r.arquivo(), base64("arquivo", r.conteudo()), r.decisoes());
        return ImportacaoResponse.de(i, true);
    }

    /** 409 IMPORTACAO_COM_MOVIMENTOS ou IMPORTACAO_DESFEITA. */
    @PostMapping("/importacoes/{id}/desfazer")
    @PreAuthorize(ADMIN)
    ImportacaoResponse desfazer(@PathVariable long id) {
        return ImportacaoResponse.de(importacoes.desfazer(id), false);
    }

    private static YearMonth mes(String valor) {
        try {
            return valor == null ? null : YearMonth.parse(valor);
        } catch (DateTimeParseException e) {
            throw ValidacaoException.doCampo("vigenteDe", "Informe o mês no formato AAAA-MM.");
        }
    }

    private static byte[] base64(String campo, String valor) {
        try {
            return valor == null ? null : Base64.getDecoder().decode(valor);
        } catch (IllegalArgumentException e) {
            throw ValidacaoException.doCampo(campo, "Arquivo ilegível.");
        }
    }

    record MensalidadeRequest(BigDecimal valor, String vigenteDe, String motivo) {
    }

    record ModeloRequest(String whatsapp, String emailAssunto, String emailCorpo) {
    }

    record ModeloResponse(TipoModelo tipo, String whatsapp, String emailAssunto, String emailCorpo,
            List<String> variaveis, String atualizadoPor, Instant atualizadoEm) {
        static ModeloResponse de(ModeloMensagem m) {
            return new ModeloResponse(m.tipo(), m.whatsapp(), m.emailAssunto(), m.emailCorpo(), m.tipo().variaveis(),
                    m.atualizacao() == null ? null : m.atualizacao().nome(),
                    m.atualizacao() == null ? null : m.atualizacao().em());
        }
    }

    record CategoriaRequest(String nome, TipoCategoria tipo, String categoriaPai) {
    }

    record ArquivoRequest(String conteudo, String tipo) {
    }

    record OrganizacaoRequest(String razaoSocial, String nomeExibicao, String cnpj, String endereco, String telefone,
            String email, ArquivoRequest logo, Boolean removerLogo, String rodapeRecibo, ChavePix.Tipo tipoChavePix,
            String chavePix, String cidadePix) {
    }

    /** @param padrao ainda valem os dados da instalação */
    record OrganizacaoResponse(String razaoSocial, String nomeExibicao, String cnpj, String endereco, String telefone,
            String email, boolean temLogo, String rodapeRecibo, ChavePix.Tipo tipoChavePix, String chavePix,
            String cidadePix, String fusoHorario, boolean padrao, String atualizadoPor, Instant atualizadoEm) {
        static OrganizacaoResponse de(Organizacao o) {
            return new OrganizacaoResponse(o.razaoSocial(), o.nomeExibicao(), o.cnpj(), o.endereco(), o.telefone(),
                    o.email(), o.logo() != null, o.rodapeRecibo(), o.pix() == null ? null : o.pix().tipo(),
                    o.pix() == null ? null : o.pix().chave(), o.pix() == null ? null : o.pix().cidade(),
                    Organizacao.FUSO_HORARIO, o.atualizacao() == null,
                    o.atualizacao() == null ? null : o.atualizacao().nome(),
                    o.atualizacao() == null ? null : o.atualizacao().em());
        }
    }

    /** @param decisoes por número de linha: IMPORTAR ou IGNORAR */
    record ImportacaoRequest(TipoImportacao tipo, String arquivo, String conteudo, Map<Integer, String> decisoes) {
    }

    record ImportacaoResponse(long id, TipoImportacao tipo, String arquivo, String usuario, Instant registradaEm,
            int linhasTotal, int linhasImportadas, List<String> mesesFechados, String situacao, boolean podeDesfazer,
            String desfeitaPor, Instant desfeitaEm) {
        static ImportacaoResponse de(Importacao i, boolean podeDesfazer) {
            return new ImportacaoResponse(i.id(), i.tipo(), i.arquivo(), i.autor().nome(), i.autor().em(),
                    i.linhasTotal(), i.linhasImportadas(), i.mesesFechados().stream().map(YearMonth::toString).toList(),
                    i.desfeita() ? "DESFEITA" : "CONCLUIDA", !i.desfeita() && podeDesfazer,
                    i.desfeitaPor() == null ? null : i.desfeitaPor().nome(),
                    i.desfeitaPor() == null ? null : i.desfeitaPor().em());
        }
    }
}
