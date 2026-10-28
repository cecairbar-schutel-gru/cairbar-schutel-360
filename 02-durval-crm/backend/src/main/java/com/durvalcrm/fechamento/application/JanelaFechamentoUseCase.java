package com.durvalcrm.fechamento.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.fechamento.domain.Autor;
import com.durvalcrm.fechamento.domain.JanelaFechamento;
import com.durvalcrm.fechamento.domain.JanelaFechamentoRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Janela de fechamento (US-CLOSING-014): o Tesoureiro ou o Administrador escolhe, nas configurações, os dias
 * de cada mês (até 7) em que o mês anterior pode ser fechado. A alteração vai para a auditoria.
 */
public class JanelaFechamentoUseCase {

    private final JanelaFechamentoRepository repositorio;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public JanelaFechamentoUseCase(JanelaFechamentoRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public JanelaFechamento vigente() {
        return repositorio.buscar().orElse(JanelaFechamento.PADRAO);
    }

    @Transactional(readOnly = true)
    public SituacaoJanela situacao() {
        return situacao(vigente());
    }

    @Transactional
    public SituacaoJanela alterar(Integer diaInicio, Integer diaFim) {
        JanelaFechamento antes = vigente();
        JanelaFechamento depois = JanelaFechamento.validar(diaInicio, diaFim,
                new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant()));
        repositorio.salvar(depois);
        auditoria.registrarAlteracao("JANELA_FECHAMENTO_ALTERADA", "JanelaFechamento", 1, dias(antes), dias(depois),
                null);
        return situacao(depois);
    }

    /** Lança FORA_DA_JANELA_FECHAMENTO fora dos dias configurados. */
    public void exigirAberta() {
        vigente().exigirAberta(LocalDate.now(relogio));
    }

    private SituacaoJanela situacao(JanelaFechamento j) {
        LocalDate hoje = LocalDate.now(relogio);
        JanelaFechamento.Intervalo intervalo = j.atualOuProxima(hoje);
        Autor a = j.alteracao();
        return new SituacaoJanela(j.diaInicio(), j.diaFim(), j.contem(hoje), intervalo.inicio(), intervalo.fim(),
                a == null ? null : a.exibicao(), a == null ? null : a.em());
    }

    private static Map<String, Object> dias(JanelaFechamento j) {
        return Map.of("diaInicio", j.diaInicio(), "diaFim", j.diaFim());
    }

    /**
     * @param aberta hoje está dentro da janela
     * @param inicio primeiro dia da janela em curso ou da próxima
     * @param fim    último dia dessa janela
     */
    public record SituacaoJanela(int diaInicio, int diaFim, boolean aberta, LocalDate inicio, LocalDate fim,
            String alteradoPor, Instant alteradoEm) {
    }
}
