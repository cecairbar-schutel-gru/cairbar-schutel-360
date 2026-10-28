package com.durvalcrm.estoque.application;

import com.durvalcrm.estoque.domain.StatusSolicitacao;
import com.durvalcrm.estoque.domain.TipoProduto;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/** Consultas de leitura do Estoque, montadas direto no banco. */
public interface ConsultaEstoquePort {

    List<ItemEstoque> listar(FiltroEstoque filtro);

    /** Na ordem de saída: próprio, depois remessas por data de recebimento. */
    List<LoteDetalhado> lotes(long produtoId);

    List<MovimentoComRemessa> movimentos(long produtoId);

    /** Categorias da cantina já usadas, em ordem alfabética. */
    List<String> categoriasCantina();

    List<ProdutoSimilar> similares(String nomeNormalizado, TipoProduto tipo, Long excetoId);

    Optional<Instant> ultimaVenda(long produtoId);

    Optional<String> nomeEditora(Long editoraId);

    /** Pendentes da mais antiga para a mais nova; as demais da mais nova para a mais antiga. */
    List<ResumoSolicitacao> solicitacoes(StatusSolicitacao status, String solicitante, int limite);

    Optional<ResumoSolicitacao> solicitacao(long id);

    List<ResumoEntradaDoacao> entradasDoacao(int limite);
}
