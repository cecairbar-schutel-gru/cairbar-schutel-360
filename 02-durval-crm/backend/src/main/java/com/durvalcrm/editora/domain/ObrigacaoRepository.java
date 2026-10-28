package com.durvalcrm.editora.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface ObrigacaoRepository {

    /** Insere (sem id) ou atualiza valor pago, status e data de estorno. */
    Obrigacao salvar(Obrigacao obrigacao);

    List<Obrigacao> listarPorOrigem(OrigemObrigacao origem, long origemId);

    /**
     * Abertas ou parcialmente pagas da editora, da mais antiga para a mais nova (ordem de alocação dos
     * pagamentos); travadas ({@code FOR UPDATE}) quando {@code travar}.
     */
    List<Obrigacao> abertas(long editoraId, boolean travar);

    List<Obrigacao> obter(Collection<Long> ids);

    void registrarCredito(long editoraId, long obrigacaoId, BigDecimal valor, Instant em);

    /** Créditos gerados por estornos menos o crédito já aplicado em pagamentos não estornados. */
    BigDecimal creditoDisponivel(long editoraId);
}
