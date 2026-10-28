package com.durvalcrm.contribuicao.application;

import com.durvalcrm.administracao.application.RegistrarAuditoriaUseCase;
import com.durvalcrm.contribuicao.domain.Competencia;
import com.durvalcrm.contribuicao.domain.CompetenciaRepository;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.transaction.annotation.Transactional;

/**
 * Geração mensal (US-CONTRIB-001): uma competência Pendente por doador ativo, com o valor vigente
 * no mês. Idempotente: quem já tem competência no mês (inclusive paga antecipadamente) é pulado.
 */
public class GerarCompetenciasMensaisUseCase {

    /** Horário do agendamento, no fuso da organização. */
    public static final LocalTime HORARIO = LocalTime.of(0, 5);
    static final String ENTIDADE = "GERACAO_COMPETENCIAS";

    private final CompetenciaRepository competencias;
    private final DoadoresPort doadores;
    private final MensalidadeVigentePort mensalidade;
    private final ExecucoesGeracaoPort execucoes;
    private final RegistrarAuditoriaUseCase auditoria;
    private final Clock relogio;

    public GerarCompetenciasMensaisUseCase(CompetenciaRepository competencias, DoadoresPort doadores,
            MensalidadeVigentePort mensalidade, ExecucoesGeracaoPort execucoes, RegistrarAuditoriaUseCase auditoria,
            Clock relogio) {
        this.competencias = competencias;
        this.doadores = doadores;
        this.mensalidade = mensalidade;
        this.execucoes = execucoes;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    /** Mês corrente ainda sem execução bem-sucedida e já passado o horário do agendamento. */
    @Transactional(readOnly = true)
    public boolean pendente(YearMonth mes) {
        boolean concluida = execucoes.buscar(mes).filter(e -> e.situacao() == ExecucaoGeracao.Situacao.SUCESSO)
                .isPresent();
        return !concluida && !LocalDateTime.now(relogio).isBefore(mes.atDay(1).atTime(HORARIO));
    }

    @Transactional
    public int gerar(YearMonth mes) {
        Instant inicio = relogio.instant();
        BigDecimal valor = mensalidade.valorPara(mes);
        Set<Long> comCompetencia = competencias.doadoresComCompetencia(mes);
        int criadas = 0;
        for (Long doadorId : doadores.listarIdsAtivos()) {
            if (!comCompetencia.contains(doadorId)) {
                competencias.salvar(Competencia.gerar(doadorId, mes, valor));
                criadas++;
            }
        }
        long duracao = relogio.millis() - inicio.toEpochMilli();
        int tentativas = execucoes.buscar(mes).map(ExecucaoGeracao::tentativas).orElse(0) + 1;
        execucoes.salvar(new ExecucaoGeracao(mes, ExecucaoGeracao.Situacao.SUCESSO, tentativas, inicio, criadas,
                duracao, null));

        Map<String, Object> detalhes = new LinkedHashMap<>();
        detalhes.put("mes", mes.toString());
        detalhes.put("criadas", criadas);
        detalhes.put("duracaoMs", duracao);
        auditoria.registrarComoSistema("COMPETENCIAS_GERADAS", ENTIDADE, mes, detalhes);
        return criadas;
    }

    /** Chamado fora da transação da geração, que já foi desfeita. */
    @Transactional
    public void registrarFalha(YearMonth mes, String erro) {
        int tentativas = execucoes.buscar(mes).map(ExecucaoGeracao::tentativas).orElse(0) + 1;
        execucoes.salvar(new ExecucaoGeracao(mes, ExecucaoGeracao.Situacao.FALHA, tentativas, relogio.instant(), 0, 0,
                erro));
    }

    @Transactional(readOnly = true)
    public SituacaoGeracao situacao() {
        YearMonth mes = YearMonth.now(relogio);
        return execucoes.buscar(mes)
                .map(e -> new SituacaoGeracao(mes, e.situacao() == ExecucaoGeracao.Situacao.SUCESSO
                        ? SituacaoGeracao.Estado.CONCLUIDA : SituacaoGeracao.Estado.FALHA, e.tentativas(),
                        e.ultimaTentativa(), e.erro()))
                .orElse(new SituacaoGeracao(mes, SituacaoGeracao.Estado.AGUARDANDO, 0, null, null));
    }
}
