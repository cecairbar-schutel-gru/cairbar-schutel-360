package com.durvalcrm.contribuicao.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * O envio do agradecimento é sempre manual (US-CONTRIB-010); o sistema só registra que a mensagem
 * foi preparada, com o canal e a data/hora.
 */
public class RegistrarMensagemPreparadaUseCase {

    public enum Canal {
        WHATSAPP,
        EMAIL
    }

    private final ContribuicaoRepository contribuicoes;
    private final RegistrarAuditoriaUseCase auditoria;

    public RegistrarMensagemPreparadaUseCase(ContribuicaoRepository contribuicoes, RegistrarAuditoriaUseCase auditoria) {
        this.contribuicoes = contribuicoes;
        this.auditoria = auditoria;
    }

    @Transactional
    public void registrar(long contribuicaoId, Canal canal) {
        if (canal == null) {
            throw ValidacaoException.doCampo("canal", "Informe o canal.");
        }
        Contribuicao c = CarregarContribuicao.ou404(contribuicoes, contribuicaoId);
        if (c.isAnonima()) {
            throw new RegraDeNegocioException("DOACAO_ANONIMA", "Doação anônima não tem mensagem de agradecimento.");
        }
        auditoria.registrar("AGRADECIMENTO_PREPARADO", CarregarContribuicao.ENTIDADE, contribuicaoId,
                Map.of("canal", canal.name(), "recibo", c.getNumeroRecibo()));
    }
}
