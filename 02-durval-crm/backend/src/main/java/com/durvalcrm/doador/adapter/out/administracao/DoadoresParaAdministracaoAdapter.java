package com.durvalcrm.doador.adapter.out.administracao;

import com.durvalcrm.administracao.application.DoadoresAdministracaoPort;
import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.application.VerificarDuplicatasUseCase;
import com.durvalcrm.doador.domain.Cpf;
import com.durvalcrm.doador.domain.DadosCadastrais;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.doador.domain.Email;
import com.durvalcrm.doador.domain.Telefone;
import com.durvalcrm.doador.domain.TipoTelefone;
import com.durvalcrm.doador.domain.ValorConsentimento;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.ErroCampo;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * O Doador entrega à Administração os anonimizados (auditoria), a contagem do painel e a importação
 * de doadores (US-ADMIN-012) com as mesmas regras do cadastro (US-DONOR-002 e 003).
 */
@Component
class DoadoresParaAdministracaoAdapter implements DoadoresAdministracaoPort {

    private static final String ENTIDADE = "DOADOR";

    private final DoadorRepository repositorio;
    private final VerificarDuplicatasUseCase duplicatas;
    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    DoadoresParaAdministracaoAdapter(DoadorRepository repositorio, VerificarDuplicatasUseCase duplicatas,
            GerenciarCompetenciasDoDoadorUseCase competencias, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.duplicatas = duplicatas;
        this.competencias = competencias;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Override
    public Set<String> anonimizados(Collection<String> ids) {
        List<Long> numericos = ids.stream().filter(i -> i.matches("\\d{1,18}")).map(Long::valueOf).toList();
        return repositorio.anonimizados(numericos).stream().map(String::valueOf).collect(Collectors.toSet());
    }

    @Override
    public long contarAtivos() {
        return repositorio.contarAtivos();
    }

    @Override
    public List<Duplicata> duplicatas(String nome, String telefone, String email) {
        return duplicatas.verificar(nome, telefone, email).stream()
                .map(d -> new Duplicata(d.doador().id(), d.doador().nome(),
                        d.motivos().stream().map(Enum::name).toList()))
                .toList();
    }

    @Override
    public List<ErroCampo> validar(DoadorImportado doador) {
        try {
            montar(doador);
            return List.of();
        } catch (ValidacaoException e) {
            return e.getErros();
        }
    }

    @Override
    public boolean cpfEmUso(String cpf) {
        return Cpf.valido(cpf) && repositorio.existeOutroComCpf(new Cpf(cpf), -1);
    }

    @Override
    public long cadastrar(DoadorImportado dados) {
        Doador salvo = repositorio.salvar(montar(dados));
        competencias.gerarPendentesImportadas(salvo.getId(), dados.competenciasPendentes());
        competencias.gerarCompetenciaDoMesAtual(salvo.getId());
        auditoria.registrar("DOADOR_IMPORTADO", ENTIDADE, salvo.getId(),
                Map.of("competenciasPendentes", dados.competenciasPendentes().size()));
        return salvo.getId();
    }

    @Override
    public boolean intocado(long doadorId) {
        return !repositorio.possuiMovimentos(doadorId);
    }

    @Override
    public void excluirImportado(long doadorId) {
        repositorio.excluirImportado(doadorId);
    }

    /** Cadastro rápido (nome e ao menos um contato) e, com CPF ou nascimento, o perfil completo. */
    private Doador montar(DoadorImportado d) {
        ValorConsentimento whatsapp = ValorConsentimento.valueOf(d.consentimentoWhatsapp());
        ValorConsentimento email = ValorConsentimento.valueOf(d.consentimentoEmail());
        Doador doador = Doador.cadastrarRapido(d.nome(), d.telefone(), d.email(), whatsapp, email, usuario.getNome(),
                relogio.instant());
        String digitos = Textos.apenasDigitos(d.telefone());
        if (d.cpf() != null || d.dataNascimento() != null || digitos.length() == 10) {
            List<Telefone> telefones = digitos.isEmpty() ? List.of()
                    : List.of(new Telefone(digitos.length() == 10 ? TipoTelefone.FIXO : TipoTelefone.CELULAR, digitos,
                            true));
            List<Email> emails = Textos.vazio(d.email()) ? List.of() : List.of(new Email(d.email().trim(), true));
            doador.atualizar(new DadosCadastrais(d.nome(), d.cpf(), d.dataNascimento(), telefones, emails, null,
                    whatsapp, email), usuario.getNome(), relogio.instant(), LocalDate.now(relogio));
        }
        return doador;
    }
}
