package com.durvalcrm.financeiro.domain;

import com.durvalcrm.shared.domain.RegraDeNegocioException;
import com.durvalcrm.shared.domain.Textos;
import com.durvalcrm.shared.domain.ValidacaoException;
import java.time.Instant;

/**
 * Troca da subcategoria de uma linha de receita ou despesa (US-FINANCIAL-021). Valor, data e conta
 * não mudam; a classificação anterior fica no histórico.
 */
public record Reclassificacao(long lancamentoId, int ordem, String categoriaAnterior, String categoriaNova,
        String alteradoPor, String alteradoPorNome, Instant alteradoEm, String motivo) {

    public static final int MAXIMO_MOTIVO = 500;

    /**
     * @param estornado o lançamento tem estorno; reclassificar só um dos dois deixaria os
     *                  relatórios por categoria desequilibrados
     */
    public static Reclassificacao de(Lancamento lancamento, boolean estornado, int ordem, Categoria atual,
            Categoria nova, String motivo, Lancamento.Autor autor) {
        NaturezaLancamento natureza = lancamento.natureza();
        if (natureza != NaturezaLancamento.RECEITA && natureza != NaturezaLancamento.DESPESA) {
            throw new RegraDeNegocioException("RECLASSIFICACAO_NAO_PERMITIDA",
                    "Só lançamentos de receita ou despesa podem ser reclassificados.");
        }
        if (estornado) {
            throw new RegraDeNegocioException("LANCAMENTO_ESTORNADO",
                    "Este lançamento foi estornado e não pode mais ser reclassificado.");
        }
        String texto = Textos.compactar(motivo);
        if (texto.isEmpty() || texto.length() > MAXIMO_MOTIVO) {
            throw ValidacaoException.doCampo("motivo", "Informe o motivo da reclassificação (até 500 caracteres).");
        }
        if (nova == null || !nova.ativa() || !nova.subcategoria() || nova.tipo() != atual.tipo()) {
            throw ValidacaoException.doCampo("categoria", "Escolha uma subcategoria ativa de "
                    + (atual.tipo() == TipoCategoria.RECEITA ? "receita." : "despesa."));
        }
        if (nova.codigo().equals(atual.codigo())) {
            throw ValidacaoException.doCampo("categoria", "Escolha uma subcategoria diferente da atual.");
        }
        return new Reclassificacao(lancamento.getId(), ordem, atual.codigo(), nova.codigo(), autor.subject(),
                autor.nome(), autor.em(), texto);
    }
}
