package com.durvalcrm.administracao.domain;

import java.util.List;

/** Só inserção e leitura: não há operação de alteração nem de exclusão (a tabela também as bloqueia). */
public interface EventoAuditoriaRepository {

    void registrar(EventoAuditoria evento);

    List<EventoAuditoria> listarPorEntidade(String entidade, String entidadeId);

    /** Mais recentes primeiro; {@code limite + 1} itens indicam que há mais páginas. */
    List<EventoAuditoria> pesquisar(FiltroAuditoria filtro, int deslocamento, int limite);

    List<String> acoes();

    List<String> entidades();

    /** Algum registro da entidade com ação diferente das informadas (ex.: algo feito sobre um doador importado). */
    boolean existeOutraAcao(String entidade, String entidadeId, List<String> acoesIgnoradas);
}
