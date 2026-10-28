package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.ChavePix;
import com.durvalcrm.administracao.domain.Organizacao;
import com.durvalcrm.administracao.domain.OrganizacaoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import com.durvalcrm.shared.application.DadosOrganizacaoPort;
import com.durvalcrm.shared.domain.Cnpj;
import java.time.Clock;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dados da organização (US-ADMIN-005). Enquanto o Administrador não os grava, valem os da
 * configuração da instalação. Recibos, comprovantes, apurações, relatórios e exportações leem os
 * dados atuais na hora de gerar (inclusive a segunda via).
 */
public class OrganizacaoUseCase implements DadosOrganizacaoPort {

    private final OrganizacaoRepository repositorio;
    private final Organizacao instalacao;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public OrganizacaoUseCase(OrganizacaoRepository repositorio, DadosOrganizacao instalacao,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.instalacao = new Organizacao(instalacao.nome(), instalacao.nome(), Cnpj.digitos(instalacao.cnpj()),
                instalacao.endereco(), null, null, null, instalacao.rodape(), null, null);
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Organizacao consultar() {
        return repositorio.buscar().orElse(instalacao);
    }

    @Override
    @Transactional(readOnly = true)
    public DadosOrganizacao atuais() {
        Organizacao o = consultar();
        return new DadosOrganizacao(o.nomeExibicao(), o.cnpj() == null ? null : Cnpj.formatar(o.cnpj()),
                o.endereco(), o.rodapeRecibo(), o.razaoSocial(), o.telefone(), o.email(),
                o.logo() == null ? null : o.logo().conteudo());
    }

    /**
     * @param logo           novo logotipo; nulo mantém o atual
     * @param removerLogo    volta ao logotipo da instalação
     */
    @Transactional
    public Organizacao salvar(String razaoSocial, String nomeExibicao, String cnpj, String endereco, String telefone,
            String email, Organizacao.Logo logo, boolean removerLogo, String rodapeRecibo, ChavePix.Tipo tipoPix,
            String chavePix, String cidadePix) {
        Organizacao antes = consultar();
        Organizacao.Logo logoFinal = removerLogo ? null : logo != null ? logo : antes.logo();
        Organizacao depois = Organizacao.validar(razaoSocial, nomeExibicao, cnpj, endereco, telefone, email, logoFinal,
                rodapeRecibo, tipoPix, chavePix, cidadePix, new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant()));
        repositorio.salvar(depois);
        Map<String, Object> depoisAuditoria = campos(depois);
        if (!mesmoLogo(antes.logo(), depois.logo())) {
            depoisAuditoria.put("logo", depois.logo() == null ? "removido" : "alterado");
        }
        auditoria.registrarAlteracao("ORGANIZACAO_ALTERADA", "Organizacao", 1, campos(antes), depoisAuditoria, null);
        return depois;
    }

    private static boolean mesmoLogo(Organizacao.Logo a, Organizacao.Logo b) {
        return a == null ? b == null : b != null && Arrays.equals(a.conteudo(), b.conteudo());
    }

    private static Map<String, Object> campos(Organizacao o) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("razaoSocial", o.razaoSocial());
        m.put("nomeExibicao", o.nomeExibicao());
        m.put("cnpj", o.cnpj());
        m.put("endereco", o.endereco());
        m.put("telefone", o.telefone());
        m.put("email", o.email());
        m.put("rodapeRecibo", o.rodapeRecibo());
        m.put("tipoChavePix", o.pix() == null ? null : o.pix().tipo().name());
        m.put("chavePix", o.pix() == null ? null : o.pix().chave());
        m.put("cidadePix", o.pix() == null ? null : o.pix().cidade());
        return m;
    }
}
