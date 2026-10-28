package com.durvalcrm.editora.application;

import com.durvalcrm.editora.domain.TituloConsignado;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * O que o módulo Editoras pede ao Estoque: títulos do catálogo e as unidades consignadas de cada
 * remessa. Implementada no Estoque, para que Editoras nunca dependa dele (ver {@code ArquiteturaTest}).
 * As transações são do chamador.
 */
public interface EstoqueConsignadoPort {

    /** Livros da editora no catálogo, ativos e inativos. */
    List<TituloConsignado> titulosDaEditora(long editoraId);

    Map<Long, TituloConsignado> titulos(Collection<Long> produtoIds);

    /** Unidades da remessa entram como consignadas, com o movimento "Entrada de remessa". */
    void entrarRemessa(long remessaId, long produtoId, int quantidade);

    /** Trava os lotes da remessa e devolve o saldo de cada produto. */
    Map<Long, Integer> travarSaldos(long remessaId, Collection<Long> produtoIds);

    /** Movimento "Devolução à editora" ligado à devolução. */
    void devolver(long remessaId, long produtoId, int quantidade, long devolucaoId);

    /** Se alguma unidade da remessa se moveu além da entrada (venda, devolução, baixa ou ajuste). */
    boolean houveMovimentoAlemDaEntrada(long remessaId);

    /** Estorna a entrada da remessa cancelada: os lotes voltam a zero. */
    void cancelarEntrada(long remessaId, Collection<Long> produtoIds);
}
