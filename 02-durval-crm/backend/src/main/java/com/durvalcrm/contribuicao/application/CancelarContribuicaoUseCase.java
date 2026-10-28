package com.durvalcrm.contribuicao.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import com.durvalcrm.contribuicao.domain.Contribuicao;
import com.durvalcrm.contribuicao.domain.ContribuicaoRepository;
import com.durvalcrm.contribuicao.domain.MeioPagamento;
import com.durvalcrm.contribuicao.domain.Valores;
import com.durvalcrm.financeiro.application.MovimentoFinanceiroUseCase;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.RegraDeNegocioException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cancelamento (US-CONTRIB-011): o original é preservado, cada linha é estornada no financeiro e
 * as competências voltam a Pendente (ou a "futura", se foram antecipadas para um mês que não chegou).
 */
public class CancelarContribuicaoUseCase {

    private final ContribuicaoRepository contribuicoes;
    private final CompetenciaRepository competencias;
    private final MovimentoFinanceiroUseCase financeiro;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public CancelarContribuicaoUseCase(ContribuicaoRepository contribuicoes, CompetenciaRepository competencias,
            MovimentoFinanceiroUseCase financeiro, RegistrarAuditoriaUseCase auditoria, CurrentUserPort usuario,
            Clock relogio) {
        this.contribuicoes = contribuicoes;
        this.competencias = competencias;
        this.financeiro = financeiro;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional
    public Contribuicao cancelar(long id, String motivo) {
        Contribuicao c = CarregarContribuicao.ou404(contribuicoes, id);
        c.cancelar(motivo, usuario.getNome(), relogio.instant());
        exigirCartaoNaoLiquidado(c);

        YearMonth mesAtual = YearMonth.now(relogio);
        int removidas = 0;
        for (Competencia competencia : competencias.listarPorContribuicao(id)) {
            if (competencia.deveSerRemovidaAoEstornar(mesAtual)) {
                competencias.excluir(competencia.getId());
                removidas++;
            } else {
                competencias.reabrir(competencia.getId());
            }
        }
        financeiro.estornar(c.getLancamentoId(), "Estorno da contribuição — recibo nº " + c.getNumeroRecibo());
        Contribuicao salva = contribuicoes.salvar(c);

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("recibo", salva.getNumeroRecibo());
        detalhes.put("motivo", salva.getMotivoCancelamento());
        detalhes.put("competenciasReabertas", salva.getCompetencias().size() - removidas);
        detalhes.put("competenciasFuturasRemovidas", removidas);
        auditoria.registrar("CONTRIBUICAO_CANCELADA", CarregarContribuicao.ENTIDADE, id, detalhes);
        return salva;
    }

    /** Se o cartão já foi liquidado, estornar deixaria Cartão a receber negativo (US-FINANCIAL-004). */
    private void exigirCartaoNaoLiquidado(Contribuicao c) {
        BigDecimal cartao = c.valorPorMeio(MeioPagamento.CARTAO);
        if (cartao.signum() == 0) {
            return;
        }
        BigDecimal saldo = financeiro.saldo(financeiro.cartaoAReceber().id());
        if (cartao.compareTo(saldo) > 0) {
            throw new RegraDeNegocioException("CARTAO_JA_LIQUIDADO", "A parte em cartão (" + Valores.brl(cartao)
                    + ") é maior que o saldo atual de Cartão a receber (" + Valores.brl(saldo)
                    + "), pois já foi liquidada. Registre uma despesa manual em vez de cancelar.");
        }
    }
}
