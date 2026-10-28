package com.durvalcrm.administracao.application;

import com.durvalcrm.administracao.domain.EventoAuditoria;
import com.durvalcrm.administracao.domain.EventoAuditoriaRepository;
import com.durvalcrm.administracao.domain.FiltroAuditoria;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.util.List;
import java.util.Set;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pesquisa do log de auditoria (US-ADMIN-009), mais recentes primeiro, e o histórico de cada
 * entidade. Dos doadores anonimizados não se mostram os valores (dados pessoais).
 */
public class ConsultarAuditoriaUseCase {

    public static final int POR_PAGINA = 50;
    static final String ENTIDADE_DOADOR = "DOADOR";

    private final EventoAuditoriaRepository repositorio;
    private final DoadoresAdministracaoPort doadores;

    public ConsultarAuditoriaUseCase(EventoAuditoriaRepository repositorio, DoadoresAdministracaoPort doadores) {
        this.repositorio = repositorio;
        this.doadores = doadores;
    }

    @Transactional(readOnly = true)
    public PaginaAuditoria pesquisar(FiltroAuditoria filtro, int pagina) {
        if (filtro.de() != null && filtro.ate() != null && filtro.de().isAfter(filtro.ate())) {
            throw ValidacaoException.doCampo("de", "A data inicial é posterior à final.");
        }
        int p = Math.max(pagina, 1);
        List<EventoAuditoria> eventos = repositorio.pesquisar(filtro, (p - 1) * POR_PAGINA, POR_PAGINA + 1);
        boolean temMais = eventos.size() > POR_PAGINA;
        return new PaginaAuditoria(protegerAnonimizados(temMais ? eventos.subList(0, POR_PAGINA) : eventos), p,
                temMais);
    }

    /** Histórico de uma entidade, do mais recente ao mais antigo. */
    @Transactional(readOnly = true)
    public List<EventoAuditoria> historico(String entidade, String entidadeId) {
        return protegerAnonimizados(repositorio.listarPorEntidade(entidade, entidadeId).reversed());
    }

    @Transactional(readOnly = true)
    public Opcoes opcoes() {
        return new Opcoes(repositorio.acoes(), repositorio.entidades());
    }

    private List<EventoAuditoria> protegerAnonimizados(List<EventoAuditoria> eventos) {
        Set<String> anonimizados = doadores.anonimizados(eventos.stream()
                .filter(e -> ENTIDADE_DOADOR.equals(e.entidade())).map(EventoAuditoria::entidadeId).distinct().toList());
        if (anonimizados.isEmpty()) {
            return eventos;
        }
        // O motivo da anonimização não é dado pessoal e continua visível.
        return eventos.stream()
                .map(e -> ENTIDADE_DOADOR.equals(e.entidade()) && anonimizados.contains(e.entidadeId())
                        && !"DOADOR_ANONIMIZADO".equals(e.acao()) ? e.semDetalhes() : e)
                .toList();
    }

    public record PaginaAuditoria(List<EventoAuditoria> itens, int pagina, boolean temMais) {
    }

    public record Opcoes(List<String> acoes, List<String> entidades) {
    }
}
