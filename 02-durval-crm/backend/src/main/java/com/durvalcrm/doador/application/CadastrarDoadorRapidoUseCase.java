package com.durvalcrm.doador.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.application.GerenciarCompetenciasDoDoadorUseCase;
import com.durvalcrm.doador.domain.Doador;
import com.durvalcrm.doador.domain.DoadorRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cadastro rápido (US-DONOR-002): cria o doador Ativo, gera a competência do mês corrente
 * (US-CONTRIB-001) e audita cada possível duplicata descartada como "outra pessoa".
 */
public class CadastrarDoadorRapidoUseCase {

    private final DoadorRepository repositorio;
    private final GerenciarCompetenciasDoDoadorUseCase competencias;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public CadastrarDoadorRapidoUseCase(DoadorRepository repositorio, GerenciarCompetenciasDoDoadorUseCase competencias,
            RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.competencias = competencias;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Doador cadastrar(CadastroRapidoCommand comando) {
        Doador novo = Doador.cadastrarRapido(comando.nome(), comando.telefone(), comando.email(),
                comando.consentimentoWhatsapp(), comando.consentimentoEmail(), usuario.getNome(), relogio.instant());
        Doador salvo = repositorio.salvar(novo);
        competencias.gerarCompetenciaDoMesAtual(salvo.getId());
        auditoria.registrar("DOADOR_CADASTRADO", AuditoriaDoador.ENTIDADE, salvo.getId(), Map.of());
        for (Long descartado : comando.duplicatasDescartadas()) {
            auditoria.registrar("DUPLICATA_DESCARTADA", AuditoriaDoador.ENTIDADE, salvo.getId(),
                    Map.of("doadorSimilarId", descartado));
        }
        return salvo;
    }
}
