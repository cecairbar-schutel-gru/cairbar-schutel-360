package com.durvalcrm.doador.domain;

import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Predicate;

/**
 * Doador recorrente. Concentra as regras do ciclo de vida (US-DONOR-002 a 008): cadastro rápido,
 * atualização do perfil, inativação, reativação e anonimização. As competências pertencem ao módulo
 * Contribuições e são tratadas pelos casos de uso.
 */
public final class Doador {

    private final Long id;
    private String nome;
    private Cpf cpf;
    private LocalDate dataNascimento;
    private StatusDoador status;
    private List<Telefone> telefones;
    private List<Email> emails;
    private Endereco endereco;
    private Consentimento consentimentoWhatsapp;
    private Consentimento consentimentoEmail;
    private final Instant criadoEm;
    private Instant inativadoEm;
    private String motivoInativacao;

    private Doador(Long id, String nome, Cpf cpf, LocalDate dataNascimento, StatusDoador status,
            List<Telefone> telefones, List<Email> emails, Endereco endereco, Consentimento consentimentoWhatsapp,
            Consentimento consentimentoEmail, Instant criadoEm, Instant inativadoEm, String motivoInativacao) {
        this.id = id;
        this.nome = nome;
        this.cpf = cpf;
        this.dataNascimento = dataNascimento;
        this.status = Objects.requireNonNull(status);
        this.telefones = List.copyOf(telefones);
        this.emails = List.copyOf(emails);
        this.endereco = endereco;
        this.consentimentoWhatsapp = Objects.requireNonNull(consentimentoWhatsapp);
        this.consentimentoEmail = Objects.requireNonNull(consentimentoEmail);
        this.criadoEm = Objects.requireNonNull(criadoEm);
        this.inativadoEm = inativadoEm;
        this.motivoInativacao = motivoInativacao;
    }

    /** Cadastro rápido (US-DONOR-002): nome completo e ao menos um contato; nasce Ativo. */
    public static Doador cadastrarRapido(String nome, String telefone, String email,
            ValorConsentimento consentimentoWhatsapp, ValorConsentimento consentimentoEmail, String autor,
            Instant agora) {
        List<ErroCampo> erros = new ArrayList<>();
        validarNome(nome, erros);
        boolean semTelefone = Textos.vazio(telefone);
        boolean semEmail = Textos.vazio(email);
        if (semTelefone && semEmail) {
            erros.add(new ErroCampo("telefone", "Informe ao menos um contato: celular ou e-mail."));
        }
        if (!semTelefone && !Telefone.valido(telefone)) {
            erros.add(new ErroCampo("telefone", "Telefone inválido. Informe DDD e 10 ou 11 dígitos."));
        }
        if (!semEmail && !Email.valido(email)) {
            erros.add(new ErroCampo("email", "E-mail inválido."));
        }
        ValidacaoException.lancarSeHouver(erros);

        List<Telefone> telefones = semTelefone ? List.of() : List.of(new Telefone(TipoTelefone.CELULAR, telefone, true));
        List<Email> emails = semEmail ? List.of() : List.of(new Email(email, true));
        return new Doador(null, Textos.compactar(nome), null, null, StatusDoador.ATIVO, telefones, emails, null,
                Consentimento.registrar(consentimentoWhatsapp, autor, agora),
                Consentimento.registrar(consentimentoEmail, autor, agora), agora, null, null);
    }

    public static Doador reconstituir(Long id, String nome, Cpf cpf, LocalDate dataNascimento, StatusDoador status,
            List<Telefone> telefones, List<Email> emails, Endereco endereco, Consentimento consentimentoWhatsapp,
            Consentimento consentimentoEmail, Instant criadoEm, Instant inativadoEm, String motivoInativacao) {
        return new Doador(id, nome, cpf, dataNascimento, status, telefones, emails, endereco, consentimentoWhatsapp,
                consentimentoEmail, criadoEm, inativadoEm, motivoInativacao);
    }

    /**
     * Atualiza o perfil completo (US-DONOR-003). A unicidade do CPF depende do repositório e é
     * verificada pelo caso de uso; aqui ficam as validações do próprio dado.
     */
    public void atualizar(DadosCadastrais dados, String autor, Instant agora, LocalDate hoje) {
        exigirNaoAnonimizado("DOADOR_ANONIMIZADO", "Doador anonimizado não pode ser alterado.");
        List<ErroCampo> erros = new ArrayList<>();
        validarNome(dados.nome(), erros);
        if (!Textos.vazio(dados.cpf()) && !Cpf.valido(dados.cpf())) {
            erros.add(new ErroCampo("cpf", "CPF inválido."));
        }
        if (dados.dataNascimento() != null && dados.dataNascimento().isAfter(hoje)) {
            erros.add(new ErroCampo("dataNascimento", "A data de nascimento não pode ser futura."));
        }
        if (dados.telefones().stream().anyMatch(t -> !Telefone.valido(t.numero()))) {
            erros.add(new ErroCampo("telefones", "Telefone inválido."));
        }
        if (dados.emails().stream().anyMatch(e -> !Email.valido(e.endereco()))) {
            erros.add(new ErroCampo("emails", "E-mail inválido."));
        }
        Endereco novoEndereco = dados.endereco() == null || dados.endereco().vazio() ? null : dados.endereco();
        if (novoEndereco != null && !novoEndereco.cep().isEmpty() && !Endereco.cepValido(novoEndereco.cep())) {
            erros.add(new ErroCampo("cep", "CEP inválido."));
        }
        ValidacaoException.lancarSeHouver(erros);

        nome = Textos.compactar(dados.nome());
        cpf = Textos.vazio(dados.cpf()) ? null : new Cpf(dados.cpf());
        dataNascimento = dados.dataNascimento();
        telefones = umPrincipal(dados.telefones(), Telefone::principal, Telefone::comPrincipal);
        emails = umPrincipal(dados.emails(), Email::principal, Email::comPrincipal);
        endereco = novoEndereco;
        if (dados.consentimentoWhatsapp() != consentimentoWhatsapp.valor()) {
            consentimentoWhatsapp = Consentimento.registrar(dados.consentimentoWhatsapp(), autor, agora);
        }
        if (dados.consentimentoEmail() != consentimentoEmail.valor()) {
            consentimentoEmail = Consentimento.registrar(dados.consentimentoEmail(), autor, agora);
        }
    }

    /** Inativação (US-DONOR-004); o destino das pendências é aplicado pelo caso de uso. */
    public void inativar(String motivo, DecisaoPendencias pendencias, Instant agora) {
        if (status != StatusDoador.ATIVO) {
            throw new RegraDeNegocioException("STATUS_INVALIDO", "Somente doadores ativos podem ser inativados.");
        }
        List<ErroCampo> erros = new ArrayList<>();
        if (Textos.vazio(motivo)) {
            erros.add(new ErroCampo("motivo", "Informe o motivo."));
        }
        if (pendencias == null) {
            erros.add(new ErroCampo("pendencias", "Decida o que fazer com as competências pendentes."));
        }
        ValidacaoException.lancarSeHouver(erros);
        status = StatusDoador.INATIVO;
        inativadoEm = agora;
        motivoInativacao = motivo.trim();
    }

    /** Reativação (US-DONOR-005): só para inativos; anonimizados nunca voltam. */
    public void reativar(String motivo) {
        if (status != StatusDoador.INATIVO) {
            throw new RegraDeNegocioException("STATUS_INVALIDO", "Somente doadores inativos podem ser reativados.");
        }
        if (Textos.vazio(motivo)) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo.");
        }
        status = StatusDoador.ATIVO;
        inativadoEm = null;
        motivoInativacao = null;
    }

    /**
     * Anonimização LGPD (US-DONOR-008): sobrescreve os dados pessoais no lugar. Um doador ativo é
     * inativado no mesmo fluxo, por isso a decisão sobre pendências é obrigatória nesse caso.
     *
     * @return {@code true} se o doador estava ativo antes da anonimização
     */
    public boolean anonimizar(String motivo, String nomeConfirmacao, DecisaoPendencias pendencias, Instant agora) {
        exigirNaoAnonimizado("STATUS_INVALIDO", "O doador já está anonimizado.");
        boolean estavaAtivo = status == StatusDoador.ATIVO;
        List<ErroCampo> erros = new ArrayList<>();
        if (Textos.vazio(motivo)) {
            erros.add(new ErroCampo("motivo", "Informe o motivo da solicitação."));
        }
        if (!Textos.normalizar(nomeConfirmacao).equals(Textos.normalizar(nome))) {
            erros.add(new ErroCampo("nomeConfirmacao", "O nome digitado não confere com o do doador."));
        }
        if (estavaAtivo && pendencias == null) {
            erros.add(new ErroCampo("pendencias", "Decida o que fazer com as competências pendentes."));
        }
        ValidacaoException.lancarSeHouver(erros);

        nome = "Doador anonimizado #" + id;
        cpf = null;
        dataNascimento = null;
        telefones = List.of();
        emails = List.of();
        endereco = null;
        consentimentoWhatsapp = Consentimento.naoInformado();
        consentimentoEmail = Consentimento.naoInformado();
        motivoInativacao = null;
        if (inativadoEm == null) {
            inativadoEm = agora;
        }
        status = StatusDoador.ANONIMIZADO;
        return estavaAtivo;
    }

    public void exigirNaoAnonimizado(String codigo, String mensagem) {
        if (status == StatusDoador.ANONIMIZADO) {
            throw new RegraDeNegocioException(codigo, mensagem);
        }
    }

    public Optional<Telefone> telefonePrincipal() {
        return telefones.stream().filter(Telefone::principal).findFirst();
    }

    public Optional<Email> emailPrincipal() {
        return emails.stream().filter(Email::principal).findFirst();
    }

    private static void validarNome(String nome, List<ErroCampo> erros) {
        if (Textos.compactar(nome).split(" ").length < 2) {
            erros.add(new ErroCampo("nome", "Informe o nome completo."));
        }
    }

    /** Garante exatamente um item principal: o primeiro marcado, ou o primeiro da lista. */
    private static <T> List<T> umPrincipal(List<T> itens, Predicate<T> principal, BiFunction<T, Boolean, T> marcar) {
        int indice = Math.max(0, itens.stream().filter(principal).findFirst().map(itens::indexOf).orElse(0));
        List<T> resultado = new ArrayList<>();
        for (int i = 0; i < itens.size(); i++) {
            resultado.add(marcar.apply(itens.get(i), i == indice));
        }
        return List.copyOf(resultado);
    }

    public Long getId() { return id; }
    public String getNome() { return nome; }
    public Optional<Cpf> getCpf() { return Optional.ofNullable(cpf); }
    public LocalDate getDataNascimento() { return dataNascimento; }
    public StatusDoador getStatus() { return status; }
    public List<Telefone> getTelefones() { return telefones; }
    public List<Email> getEmails() { return emails; }
    public Endereco getEndereco() { return endereco; }
    public Consentimento getConsentimentoWhatsapp() { return consentimentoWhatsapp; }
    public Consentimento getConsentimentoEmail() { return consentimentoEmail; }
    public Instant getCriadoEm() { return criadoEm; }
    public Instant getInativadoEm() { return inativadoEm; }
    public String getMotivoInativacao() { return motivoInativacao; }
}
