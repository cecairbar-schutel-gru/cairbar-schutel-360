package com.durvalcrm.administracao.infrastructure;

import com.durvalcrm.administracao.application.ConsultarAuditoriaUseCase;
import com.durvalcrm.administracao.application.DoadoresAdministracaoPort;
import com.durvalcrm.administracao.application.IdentidadesPort;
import com.durvalcrm.administracao.application.ImportacaoUseCase;
import com.durvalcrm.administracao.application.MensalidadeUseCase;
import com.durvalcrm.administracao.application.ModelosMensagemUseCase;
import com.durvalcrm.administracao.application.OrganizacaoUseCase;
import com.durvalcrm.administracao.application.PainelAdministradorUseCase;
import com.durvalcrm.administracao.application.PlanoDeContasUseCase;
import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.administracao.application.UsuariosUseCase;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.administracao.domain.ImportacaoRepository;
import com.durvalcrm.administracao.domain.ModeloMensagemRepository;
import com.durvalcrm.administracao.domain.OrganizacaoRepository;
import com.durvalcrm.administracao.domain.PlanoDeContasRepository;
import com.durvalcrm.administracao.domain.ValorMensalidadeRepository;
import com.durvalcrm.fechamento.application.FechamentoMensalUseCase;
import com.durvalcrm.financeiro.application.ContasFinanceirasUseCase;
import com.durvalcrm.financeiro.application.DemonstrativoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.financeiro.application.PeriodoFinanceiroPort;
import com.durvalcrm.shared.application.ContextoRequisicaoPort;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.application.DadosOrganizacao;
import java.time.Clock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AdministracaoConfiguration {

    @Bean
    RegistrarAuditoriaUseCase registrarAuditoriaUseCase(EventoAuditoriaRepository repositorio, CurrentUserPort usuario,
            ContextoRequisicaoPort requisicao, Clock relogio) {
        return new RegistrarAuditoriaUseCase(repositorio, usuario, requisicao, relogio);
    }

    @Bean
    ConsultarAuditoriaUseCase consultarAuditoriaUseCase(EventoAuditoriaRepository repositorio,
            DoadoresAdministracaoPort doadores) {
        return new ConsultarAuditoriaUseCase(repositorio, doadores);
    }

    @Bean
    MensalidadeUseCase mensalidadeUseCase(ValorMensalidadeRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        return new MensalidadeUseCase(repositorio, auditoria, usuario, relogio);
    }

    @Bean
    ModelosMensagemUseCase modelosMensagemUseCase(ModeloMensagemRepository repositorio,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new ModelosMensagemUseCase(repositorio, auditoria, usuario, relogio);
    }

    @Bean
    PlanoDeContasUseCase planoDeContasUseCase(PlanoDeContasRepository repositorio, RegistrarAuditoriaUseCase auditoria) {
        return new PlanoDeContasUseCase(repositorio, auditoria);
    }

    /**
     * Também é o {@code DadosOrganizacaoPort} de recibos, comprovantes e relatórios. Os dados da
     * instalação valem até o Administrador gravar os da organização (US-ADMIN-005).
     */
    @Bean
    OrganizacaoUseCase organizacaoUseCase(OrganizacaoRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio, @Value("${durvalcrm.organizacao.nome}") String nome,
            @Value("${durvalcrm.organizacao.cnpj:}") String cnpj,
            @Value("${durvalcrm.organizacao.endereco:}") String endereco,
            @Value("${durvalcrm.organizacao.rodape-recibo:}") String rodape) {
        return new OrganizacaoUseCase(repositorio, new DadosOrganizacao(nome, cnpj, endereco, rodape), auditoria,
                usuario, relogio);
    }

    @Bean
    UsuariosUseCase usuariosUseCase(IdentidadesPort identidades) {
        return new UsuariosUseCase(identidades);
    }

    @Bean
    PainelAdministradorUseCase painelAdministradorUseCase(DoadoresAdministracaoPort doadores,
            DemonstrativoFinanceiroUseCase financeiro, MensalidadeUseCase mensalidade, Clock relogio) {
        return new PainelAdministradorUseCase(doadores, financeiro, mensalidade, relogio);
    }

    @Bean
    ImportacaoUseCase importacaoUseCase(ImportacaoRepository importacoes, PlanoDeContasRepository plano,
            ContasFinanceirasUseCase contas, MovimentoFinanceiroUseCase financeiro, PeriodoFinanceiroPort periodos,
            FechamentoMensalUseCase fechamento, DoadoresAdministracaoPort doadores, EventoAuditoriaRepository eventos,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        return new ImportacaoUseCase(importacoes, plano, contas, financeiro, periodos, fechamento, doadores, eventos,
                auditoria, usuario, relogio);
    }
}
