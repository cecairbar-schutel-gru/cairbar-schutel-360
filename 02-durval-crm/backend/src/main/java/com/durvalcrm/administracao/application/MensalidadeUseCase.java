package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.Autor;
import com.durvalcrm.administracao.domain.TabelaMensalidade;
import com.durvalcrm.administracao.domain.ValorMensalidade;
import com.durvalcrm.administracao.domain.ValorMensalidadeRepository;
import com.durvalcrm.shared.application.CurrentUserPort;
import com.durvalcrm.shared.domain.Textos;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.transaction.annotation.Transactional;

/**
 * Valor futuro da mensalidade (US-ADMIN-002): vigente, agendado e histórico. A geração das
 * competências (US-CONTRIB-001) e os meses futuros da seleção (US-CONTRIB-002) usam o valor do mês
 * pela {@link #valorPara(YearMonth)}; competências já geradas nunca mudam.
 */
public class MensalidadeUseCase {

    static final String ENTIDADE = "Mensalidade";

    private final ValorMensalidadeRepository repositorio;
    private final RegistrarAuditoriaUseCase auditoria;
    private final CurrentUserPort usuario;
    private final Clock relogio;

    public MensalidadeUseCase(ValorMensalidadeRepository repositorio, RegistrarAuditoriaUseCase auditoria,
            CurrentUserPort usuario, Clock relogio) {
        this.repositorio = repositorio;
        this.auditoria = auditoria;
        this.usuario = usuario;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public BigDecimal valorPara(YearMonth mes) {
        return tabela().valorPara(mes);
    }

    @Transactional(readOnly = true)
    public SituacaoMensalidade consultar() {
        YearMonth atual = YearMonth.now(relogio);
        TabelaMensalidade t = tabela();
        return new SituacaoMensalidade(t.vigente(atual), t.agendada(atual).orElse(null), t.historico(), atual);
    }

    @Transactional
    public SituacaoMensalidade agendar(BigDecimal valor, YearMonth vigenteDe, String motivo) {
        repositorio.travar();
        YearMonth atual = YearMonth.now(relogio);
        TabelaMensalidade t = tabela();
        t.exigirSemAgendamento(atual);
        t.validar(valor, vigenteDe, motivo, atual);
        ValorMensalidade novo = repositorio.inserir(new ValorMensalidade(null, valor, vigenteDe,
                Textos.compactar(motivo), autor()));
        auditoria.registrarAlteracao("MENSALIDADE_AGENDADA", ENTIDADE, novo.id(),
                Map.of("valor", t.vigente(atual).valor()), resumo(novo), novo.motivo());
        return consultar();
    }

    @Transactional
    public SituacaoMensalidade alterarAgendada(BigDecimal valor, YearMonth vigenteDe, String motivo) {
        repositorio.travar();
        YearMonth atual = YearMonth.now(relogio);
        TabelaMensalidade t = tabela();
        ValorMensalidade agendada = t.exigirAgendada(atual);
        t.validar(valor, vigenteDe, motivo, atual);
        ValorMensalidade alterada = new ValorMensalidade(agendada.id(), valor, vigenteDe, Textos.compactar(motivo),
                autor());
        repositorio.atualizar(alterada);
        auditoria.registrarAlteracao("MENSALIDADE_AGENDAMENTO_ALTERADO", ENTIDADE, agendada.id(), resumo(agendada),
                resumo(alterada), alterada.motivo());
        return consultar();
    }

    @Transactional
    public SituacaoMensalidade cancelarAgendada() {
        repositorio.travar();
        ValorMensalidade agendada = tabela().exigirAgendada(YearMonth.now(relogio));
        repositorio.excluir(agendada.id());
        auditoria.registrarAlteracao("MENSALIDADE_AGENDAMENTO_CANCELADO", ENTIDADE, agendada.id(), resumo(agendada),
                null, null);
        return consultar();
    }

    private TabelaMensalidade tabela() {
        return new TabelaMensalidade(repositorio.listar());
    }

    private Autor autor() {
        return new Autor(usuario.getSubject(), usuario.getNome(), relogio.instant());
    }

    private static Map<String, Object> resumo(ValorMensalidade v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("valor", v.valor());
        m.put("vigenteDe", v.vigenteDe().toString());
        return m;
    }

    /** @param historico do mais recente ao mais antigo, inclusive o agendado */
    public record SituacaoMensalidade(ValorMensalidade vigente, ValorMensalidade agendada,
            List<ValorMensalidade> historico, YearMonth mesAtual) {
    }
}
